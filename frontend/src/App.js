import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // --- STATE MANAGEMENT ---
  // Form state
  const [url, setUrl] = useState('https://en.wikipedia.org/wiki/HMS_Example_(P165)');
  const [maxPages, setMaxPages] = useState(10);
  
  // Data display state
  const [groupedArchives, setGroupedArchives] = useState({});
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedStartUrlPath, setSelectedStartUrlPath] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);

  // --- CORE LOGIC ---

  /**
   * Fetches all archive data from the backend and processes it
   * into a nested structure for the 4-column display.
   */
  const fetchArchives = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/archives');
      const domains = await response.json();
      const allArchives = {};
      for (const domain of domains) {
        const versionsRes = await fetch(`http://localhost:3001/api/archives/${domain}`);
        allArchives[domain] = await versionsRes.json();
      }
      setGroupedArchives(groupArchives(domains, allArchives));
    } catch (error) {
      console.error('Failed to fetch archives:', error);
    }
  };

  // Fetch archives on initial component mount.
  useEffect(() => {
    fetchArchives();
  }, []);
  
  /**
   * Triggers the backend archiving process for a given URL.
   * @param {string} urlToArchive - The URL to be archived.
   */
  const triggerArchive = async (urlToArchive) => {
    const normalizedUrl = normalizeUrl(urlToArchive);
    if (!normalizedUrl) return alert('URL is empty.');

    setIsLoading(true);
    try {
      await fetch('http://localhost:3001/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl, maxPages: Number(maxPages) }),
      });
      alert(`Archiving process for ${normalizedUrl} has started. The list will refresh shortly.`);
      // Poll for new data after a delay
      setTimeout(fetchArchives, 8000);
    } catch (error) {
      console.error('Error submitting URL:', error);
      alert('Failed to start archiving process.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- HELPER FUNCTIONS ---

  /**
   * Normalizes a URL string by ensuring it has a protocol.
   * @param {string} urlString The user-provided URL.
   * @returns {string} A URL with https:// prepended if necessary.
   */
  const normalizeUrl = (urlString) => {
    const trimmedUrl = urlString.trim();
    if (!trimmedUrl) return '';
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return 'https://' + trimmedUrl;
    }
    return trimmedUrl;
  };

  /**
   * Processes the flat list of archives from the API into a nested object
   * organized by domain, then by start page path.
   * @param {string[]} domains - An array of domain names.
   * @param {object} allArchives - An object mapping domains to arrays of version data.
   * @returns {object} The nested data structure for the UI.
   */
  const groupArchives = (domains, allArchives) => {
    const grouped = {};
    for (const domain of domains) {
      grouped[domain] = {};
      const versions = allArchives[domain] || [];
      versions.forEach(version => {
        const path = getPathFromUrl(version.startUrl);
        if (!grouped[domain][path]) {
          grouped[domain][path] = [];
        }
        grouped[domain][path].push(version);
      });
    }
    return grouped;
  };

  /**
   * Extracts the pathname from a full URL string.
   * @param {string} urlString - The full URL.
   * @returns {string} The pathname part of the URL.
   */
  const getPathFromUrl = (urlString) => {
    try {
      return new URL(urlString).pathname;
    } catch (e) {
      return urlString;
    }
  };

  /**
   * Formats a timestamp string for display.
   * @param {string} timestamp - The timestamp ID string from the backend.
   * @returns {string} A localized date-time string.
   */
  const formatTimestamp = (timestamp) => {
    const parsableDateString = timestamp.split('T')[0] + 'T' + timestamp.split('T')[1].replace(/-/g, ':');
    return new Date(parsableDateString).toLocaleString();
  };

  // --- EVENT HANDLERS ---
  const handleDomainSelect = (domain) => {
    setSelectedDomain(domain);
    setSelectedStartUrlPath(null);
    setSelectedVersion(null);
  };

  const handleStartUrlPathSelect = (path) => {
    setSelectedStartUrlPath(path);
    setSelectedVersion(null);
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    triggerArchive(url);
  };

  // --- RENDER ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>Web Archiver 🕸️</h1>
        <p>Enter a URL to capture a new snapshot of a website.</p>
        <form onSubmit={handleFormSubmit} className="archive-form">
          <input
            type="text"
            placeholder="example.com"
            className="url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Archiving...' : 'Archive Site'}
          </button>
        </form>
      </header>
      
      <div className="settings-bar">
        <label htmlFor="max-pages">Number of links to also archive found in the given URL:</label>
        <input
          type="number"
          id="max-pages"
          value={maxPages}
          onChange={(e) => setMaxPages(e.target.value)}
          min="1"
          className="max-pages-input"
          disabled={isLoading}
          title="Max pages to crawl for any new archive action"
        />
      </div>

      <main className="archive-viewer">
        <h2>View Archives</h2>
        <div className="archive-container">
          {/* Column 1: Site */}
          <div className="archive-column">
            <h3>Site</h3>
            {Object.keys(groupedArchives).length > 0 ? (
              <ul>
                {Object.keys(groupedArchives).map((domain) => (
                  <li key={domain} className={selectedDomain === domain ? 'selected' : ''} onClick={() => handleDomainSelect(domain)}>
                    {domain}
                  </li>
                ))}
              </ul>
            ) : <p>No sites archived yet.</p>}
          </div>

          {/* Column 2: Start Page */}
          <div className="archive-column">
            <h3>Start Page</h3>
            {selectedDomain ? (
              <ul>
                {Object.keys(groupedArchives[selectedDomain]).map((path) => (
                  <li key={path} className={selectedStartUrlPath === path ? 'selected' : ''} onClick={() => handleStartUrlPathSelect(path)}>
                    {path}
                  </li>
                ))}
              </ul>
            ) : <p>Select a site.</p>}
          </div>
          
          {/* Column 3: Timestamp */}
          <div className="archive-column">
            <h3>Timestamp</h3>
            {selectedStartUrlPath ? (
              <ul>
                {groupedArchives[selectedDomain][selectedStartUrlPath].map((version) => (
                  <li key={version.id} className={selectedVersion?.id === version.id ? 'selected' : ''} onClick={() => setSelectedVersion(version)}>
                    {formatTimestamp(version.id)}
                  </li>
                ))}
              </ul>
            ) : <p>Select a start page.</p>}
          </div>

          {/* Column 4: Snapshot Details */}
          <div className="archive-column">
            <h3>Snapshot Details</h3>
            {selectedVersion ? (
              <>
                <a className="action-button view-button" href={`http://localhost:3001/view/${selectedDomain}/${selectedVersion.id}/${selectedVersion.entrypoint}`} target="_blank" rel="noopener noreferrer">
                  View Snapshot
                </a>
                <button 
                  className="action-button refresh-button" 
                  onClick={() => triggerArchive(selectedVersion.startUrl)}
                  disabled={isLoading}
                >
                  Refresh Snapshot
                </button>
                <h4 className="pages-list-header">Archived pages in Snapshot</h4>
                <ul className="crawled-pages-list">
                  {selectedVersion.crawledPages.map((pageUrl, index) => (
                    <li key={index} title={pageUrl}>{getPathFromUrl(pageUrl)}</li>
                  ))}
                </ul>
              </>
            ) : <p>Select a timestamp.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;