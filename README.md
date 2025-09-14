# Web Archiver

A simple web archiving tool, similar to the Wayback Machine, that captures snapshots of websites for later viewing. This project uses a React frontend and a Node.js/Express backend to fetch, save, and serve self-contained versions of websites.

## Features

  * **Archive Any URL:** Enter a public URL to start the archiving process.
  * **Recursive Crawling:** Captures the starting page and recursively follows same-domain links.
  * **Configurable Page Limit:** Set the maximum number of pages to capture for each crawl session.
  * **Self-Contained Snapshots:** Saves all necessary assets (HTML, CSS, images, JS) to render pages offline exactly as they appeared.
  * **Interactive UI:** A four-column interface to browse archives by Site -\> Start Page -\> Timestamp -\> Snapshot Details.
  * **One-Click Re-archiving:** Easily capture an updated snapshot of any previously archived page.
  * **Intelligent Link Rewriting:** Internal links within an archive point to other saved pages, while external or un-crawled links point to their original live URLs.

## Tech Stack

  * **Frontend:** React
  * **Backend:** Node.js, Express
  * **Core Libraries:**
      * `axios` for making HTTP requests.
      * `cheerio` for parsing and manipulating HTML on the server.
      * `fs-extra` for file system operations.
      * `cors` for enabling cross-origin requests.

## Project Structure

```
web-archiver/
├── backend/
│   ├── archives/         # Saved snapshots are stored here
│   ├── node_modules/
│   ├── package.json
│   └── server.js         # The Express server
└── frontend/
    ├── public/
    ├── src/
    │   ├── App.css
    │   └── App.js        # The main React component
    └── package.json
```

## Setup and Running Instructions

### Prerequisites

  * Node.js and npm (or yarn) installed on your machine.

### 1\. Set up the Backend

First, clone & get the server running.

```bash
#Navigate to a directory of your choosing
git clone https://github.com/jwoeifjofwefawsfasd/gb-webArchiver.git

# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Run the server
node server.js
```

The backend server will start on `http://localhost:3001`.

### 2\. Set up the Frontend

Open a **new terminal window** and navigate to the `frontend` directory.

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Run the React development server
npm start
```

Your browser will automatically open to `http://localhost:3000`, where you can use the application.

## How to Use

1.  Enter a URL (e.g., `example.com`) into the input field.
2.  Adjust the **Page Limit** to control how many pages the crawler will attempt to save.
3.  Click **Archive Site**. The process will start in the background.
4.  After a few moments, the new archive will appear in the "View Archives" section.
5.  Use the four columns to navigate to the specific snapshot you wish to view or refresh.
