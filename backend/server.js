/**
 * Web Archiver Backend
 * * This Express server provides an API to crawl and archive websites.
 * It uses a two-pass approach:
 * 1. Crawl pages and fetch all assets, holding HTML in memory.
 * 2. Rewrite internal links and save final HTML files to disk.
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use('/view', express.static(path.join(__dirname, 'archives')));


// =================================================================
// --- CORE CRAWLING LOGIC ---
// =================================================================

/**
 * Calculates the local file path for a given URL to be saved on disk.
 * @param {string} pageUrl - The full URL of the page.
 * @param {string} startUrl - The initial URL the crawl started with.
 * @param {string} archivePath - The base path for the current archive session.
 * @returns {string} The absolute local file path for the HTML file.
 */
function getLocalFilePathForPage(pageUrl, startUrl, archivePath) {
    const urlObject = new URL(pageUrl);
    const startUrlObject = new URL(startUrl);
    let pageFilename = urlObject.pathname.replace(/^\/|\/$/g, '');

    // Sanitize path for the file system.
    pageFilename = pageFilename.replace(/[<>:"/\\|?*]/g, '_');

    if (pageFilename === '' || urlObject.hostname !== startUrlObject.hostname) {
        pageFilename = 'index.html';
    } else if (!path.extname(pageFilename)) {
        pageFilename = path.join(pageFilename, 'index.html');
    }
    return path.join(archivePath, pageFilename);
}

/**
 * Fetches a single page and all its assets (CSS, JS, images).
 * Assets are saved to disk, but the HTML is held in memory.
 * @param {string} url - The URL of the page to fetch.
 * @param {string} archivePath - The base path for the current archive session.
 * @param {string} startUrl - The initial URL the crawl started with.
 * @returns {Promise<object|null>} An object with the Cheerio instance ($) and discovered links, or null on failure.
 */
async function fetchPageAndAssets(url, archivePath, startUrl) {
    try {
        console.log(`[LOG] Fetching page and assets for: ${url}`);
        const config = {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/5.37.36' }
        };

        const response = await axios.get(url, { ...config, timeout: 15000 });
        const htmlContent = response.data;
        const $ = cheerio.load(htmlContent);
        const startDomain = new URL(startUrl).hostname;
        
        // Discover same-domain links for the queue
        const discoveredLinks = [];
        $('a').each((_, element) => {
            const link = $(element).attr('href');
            if (link) {
                try {
                    const absoluteLink = new URL(link, url).href.split('#')[0];
                    if (new URL(absoluteLink).hostname === startDomain) {
                        discoveredLinks.push(absoluteLink);
                    }
                } catch (e) { /* Ignore invalid links */ }
            }
        });

        // Create a unique subfolder for this page's assets to prevent filename collisions.
        const localPagePath = getLocalFilePathForPage(url, startUrl, archivePath);
        const pageUrlObject = new URL(url);
        const safePageIdentifier = (pageUrlObject.pathname.replace(/^\/|\/$/g, '') || 'index').replace(/[\/\?%*:|"<>]/g, '_');

        // Process and save all assets.
        const assetPromises = [];
        let counters = { css: 0, img: 0, js: 0 };
        $('link[rel="stylesheet"], img, script').each((_, element) => {
            const el = $(element);
            const tagName = el.prop('tagName').toLowerCase();
            let fileUrl = '', extension = '', filename = '', attr = '';

            if (tagName === 'link') {
                attr = 'href'; fileUrl = el.attr(attr); filename = `style-${++counters.css}.css`;
            } else if (tagName === 'img') {
                attr = 'src'; fileUrl = el.attr('srcset') ? el.attr('srcset').split(',')[0].trim().split(' ')[0] : el.attr(attr); extension = path.extname(new URL(fileUrl, url).pathname) || '.jpg'; filename = `image-${++counters.img}${extension}`;
            } else if (tagName === 'script') {
                attr = 'src'; fileUrl = el.attr(attr); extension = path.extname(new URL(fileUrl, url).pathname) || '.js'; filename = `script-${++counters.js}${extension}`;
            }

            if (fileUrl && !fileUrl.startsWith('data:')) {
                const absoluteUrl = new URL(fileUrl, url).href;
                const assetSavePath = path.join(archivePath, 'assets', safePageIdentifier, filename);
                assetPromises.push(
                    axios.get(absoluteUrl, { ...config, responseType: 'arraybuffer' })
                        .then(res => {
                            fs.ensureDirSync(path.dirname(assetSavePath));
                            fs.writeFileSync(assetSavePath, res.data);
                            const relativePath = path.relative(path.dirname(localPagePath), assetSavePath);
                            el.attr(attr, relativePath.replace(/\\/g, '/'));
                            if (tagName === 'img') el.removeAttr('srcset');
                        })
                        .catch(err => {
                            if (err.response) {
                                console.error(`[ERROR ${err.response.status}] Could not download asset: ${absoluteUrl}`);
                            } else {
                                console.error(`[ERROR] Could not download asset: ${absoluteUrl} (${err.message})`);
                            }
                        })
                );
            }
        });

        await Promise.all(assetPromises);
        console.log(`✓ Fetched assets for: ${url}`);
        return { $, discoveredLinks: [...new Set(discoveredLinks)] };

    } catch (error) {
        console.error(`✗ Failed to fetch page ${url}: ${error.message}`);
        return null;
    }
}

/**
 * Orchestrates the entire crawl process using a two-pass system.
 * @param {string} startUrl - The URL to begin crawling from.
 * @param {number} maxPagesToCrawl - The maximum number of pages to crawl.
 */
async function startCrawl(startUrl, maxPagesToCrawl) {
    console.log(`[LOG] Starting crawl for: ${startUrl} (Max Pages: ${maxPagesToCrawl})`);
    const urlObject = new URL(startUrl);
    const domain = urlObject.hostname;
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const archivePath = path.join(__dirname, 'archives', domain, timestamp);
    await fs.ensureDir(archivePath);
    
    const queue = [startUrl];
    const visited = new Set();
    const pageDataMap = new Map(); // Stores { url -> { $ } } in memory

    // --- PASS 1: CRAWL AND FETCH ---
    // Fetches all pages and their assets, holding HTML content in memory.
    console.log('\n--- Starting Pass 1: Crawling and Fetching Pages ---');
    while (queue.length > 0 && visited.size < maxPagesToCrawl) {
        const currentUrl = queue.shift();
        if (visited.has(currentUrl)) continue;

        const fetchResult = await fetchPageAndAssets(currentUrl, archivePath, startUrl);
        if (!fetchResult) continue;
        
        visited.add(currentUrl);
        pageDataMap.set(currentUrl, { $: fetchResult.$ });

        fetchResult.discoveredLinks.forEach(link => {
            if (!visited.has(link) && !queue.includes(link)) {
                queue.push(link);
            }
        });
    }

    // --- PASS 2: REWRITE LINKS AND SAVE HTML ---
    // Iterates through the in-memory pages to intelligently rewrite links before saving.
    console.log('\n--- Starting Pass 2: Rewriting Links and Saving HTML ---');
    for (const [currentUrl, data] of pageDataMap.entries()) {
        const { $ } = data;
        const localPagePath = getLocalFilePathForPage(currentUrl, startUrl, archivePath);

        $('a').each((_, element) => {
            const linkEl = $(element);
            const href = linkEl.attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                try {
                    const absoluteLinkUrl = new URL(href, currentUrl).href.split('#')[0];
                    if (new URL(absoluteLinkUrl).hostname === domain && visited.has(absoluteLinkUrl)) {
                        // If it's an archived link, rewrite to local relative path
                        const linkedPageLocalPath = getLocalFilePathForPage(absoluteLinkUrl, startUrl, archivePath);
                        const relativePath = path.relative(path.dirname(localPagePath), linkedPageLocalPath);
                        linkEl.attr('href', relativePath.replace(/\\/g, '/') || './index.html');
                    } else {
                        // If it's an external or non-archived link, rewrite to its absolute live URL
                        linkEl.attr('href', absoluteLinkUrl);
                    }
                } catch (e) { /* Ignore invalid hrefs */ }
            }
        });

        await fs.ensureDir(path.dirname(localPagePath));
        await fs.writeFile(localPagePath, $.html());
        console.log(`✓ Saved final HTML for: ${currentUrl}`);
    }

    // Create a manifest file with metadata about the crawl.
    const entryPointPath = getLocalFilePathForPage(startUrl, startUrl, archivePath);
    const relativeEntryPoint = path.relative(archivePath, entryPointPath).replace(/\\/g, '/');
    const manifest = {
        startUrl: startUrl,
        entrypoint: relativeEntryPoint,
        archivedAt: new Date().toISOString(),
        crawledPages: Array.from(visited).sort()
    };
    await fs.writeFile(path.join(archivePath, '_manifest.json'), JSON.stringify(manifest, null, 2));

    console.log(`\n✅ Crawl complete. ${visited.size} pages archived in ${archivePath}`);
}


// =================================================================
// --- API ENDPOINTS ---
// =================================================================

app.post('/api/archive', (req, res) => {
    console.log('[LOG] Received POST request on /api/archive');
    const { url, maxPages } = req.body;
    console.log(`[LOG] URL: ${url}, Max Pages: ${maxPages}`);
    
    if (!url) {
        console.error('[ERROR] URL is required');
        return res.status(400).json({ message: 'URL is required' });
    }
    
    const maxPagesToCrawl = maxPages > 0 ? maxPages : 10;

    try {
      // Run crawl in the background; don't await it.
      startCrawl(url, maxPagesToCrawl);
      res.json({ message: `Archiving process for ${url} has started.` });
    } catch(err) {
      console.error(`[ERROR] Failed to start crawl for ${url}: ${err.message}`);
      res.status(500).json({ message: `Failed to start crawl: ${err.message}`})
    }
});

app.get('/api/archives', async (req, res) => {
    const archivesDir = path.join(__dirname, 'archives');
    try {
        await fs.ensureDir(archivesDir);
        const domains = await fs.readdir(archivesDir);
        res.json(domains.filter(d => fs.lstatSync(path.join(archivesDir, d)).isDirectory()));
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch archives.' });
    }
});

app.get('/api/archives/:domain', async (req, res) => {
    const { domain } = req.params;
    const domainDir = path.join(__dirname, 'archives', domain);
    try {
        const versionFolders = await fs.readdir(domainDir);
        const versionsWithData = [];
        for (const folder of versionFolders) {
            const manifestPath = path.join(domainDir, folder, '_manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = await fs.readJson(manifestPath);
                versionsWithData.push({
                    id: folder,
                    startUrl: manifest.startUrl,
                    entrypoint: manifest.entrypoint,
                    crawledPages: manifest.crawledPages
                });
            }
        }
        res.json(versionsWithData.sort((a, b) => b.id.localeCompare(a.id)));
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch versions.' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});