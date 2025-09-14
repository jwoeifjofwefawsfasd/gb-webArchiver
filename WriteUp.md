# Web Archiver: Project Write-up

**Author:** Jason Koo
**Date:** September 14, 2025

This write-up covers the main design choices, trade-offs, and future plans for the Web Archiver project. The goal was to build a working prototype that balances speed of development with a solid set of core features.

---

### Decisions and Trade-offs

I made a few key technical decisions, each with a specific trade-off.

1.  **Crawling Engine: `axios` + `cheerio`**
    * **Why:** I picked this stack because it's fast, light on resources, and great for standard, server-rendered websites. It let me build the core features quickly.
    * **Trade-off:** The main downside is that it can't run JavaScript. This means it struggles to archive modern single-page apps that build their content on the client side. I accepted this limitation to focus on getting the core archiving pipeline working first.

2.  **Storage: Local File System**
    * **Why:** Using the file system was the simplest way to store snapshots. It required no database setup and made it easy to inspect the archived files directly.
    * **Trade-off:** This approach doesn't scale. It's difficult to manage or query metadata across thousands of archives, and it isn't suitable for a multi-user environment.

3.  **Architecture: Two-Pass Crawler**
    * **Why:** I designed the crawler to work in two passes. The first pass fetches all pages and assets, while the second pass rewrites the links before saving the HTML. This ensures that a saved page only links to other pages that were also successfully captured in that same session.
    * **Trade-off:** This uses more memory than a single-pass approach because it holds all page content in memory until the crawl is finished.

---

### What I Would Do with More Time

With more time, I'd focus on these improvements:

1.  **Switch to a Headless Browser:** My first priority would be to replace `axios`/`cheerio` with a library like `Puppeteer` or `Playwright`. This would solve the JavaScript problem and allow the tool to accurately archive modern web apps.
2.  **Add a Job Queue:** Right now, crawls run immediately and can block the server. I would implement a job queue (like `BullMQ` with Redis) to handle archiving tasks in the background, allowing for concurrency and retries on failed pages.
3.  **Improve the Frontend:** I'd add real-time progress updates with WebSockets to show the user what's happening during a crawl. A "diff viewer" to compare two versions of a page would also be a great feature.

---

### How I Would Scale This for Production

Taking this to a production level would require a significant architectural overhaul.

1.  **Separate the Crawler:** I'd pull the crawling logic out into independent worker services running in Docker or on a cloud platform. The main API would just add jobs to a message queue (like AWS SQS).
2.  **Move to Cloud Storage:** I'd replace the local file system with a cloud-based solution. Assets (CSS, images) would go into an object store like AWS S3, and all the metadata from the `_manifest.json` files would be moved into a proper database like PostgreSQL for efficient querying.
3.  **Use a CDN:** I'd serve both the React frontend and the archived assets from S3 through a CDN like CloudFront to ensure the application is fast for users anywhere.
```eof