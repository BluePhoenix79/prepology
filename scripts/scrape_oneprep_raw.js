/**
 * Generic Network Interceptor for OnePrep
 * =======================================
 * 
 * HOW TO USE:
 * 1. Go to the OnePrep website where you view questions or practice tests.
 * 2. Open DevTools (F12 or Ctrl+Shift+I) -> Console tab.
 * 3. Paste this ENTIRE script and press Enter.
 * 4. Navigate through the site, load questions, practice tests, etc.
 * 5. Type: getScraperStatus() to see how many requests have been captured.
 * 6. Type: downloadRawData() to save everything as a JSON file.
 * 7. Send the JSON file to me so we can analyze the structure and write a parser!
 */

(function installOnePrepInterceptor() {
  'use strict';

  window.__ONEPREP_RAW_DATA__ = window.__ONEPREP_RAW_DATA__ || [];
  
  // Helper to store response
  function storeResponse(url, body, method = 'GET') {
    try {
      if (!body) return;
      let parsed = null;
      if (typeof body === 'string') {
        try { parsed = JSON.parse(body); } catch(e) {}
      } else if (typeof body === 'object') {
        parsed = body;
      }

      if (parsed) {
        window.__ONEPREP_RAW_DATA__.push({
          timestamp: new Date().toISOString(),
          url,
          method,
          data: parsed
        });
        console.log(`[Interceptor] Captured JSON from: ${url}`);
      }
    } catch (e) {
      console.error('[Interceptor] Error storing response', e);
    }
  }

  // Intercept Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : 'unknown_url');
    const method = (args[1] && args[1].method) ? args[1].method : 'GET';
    
    try {
      const response = await originalFetch.apply(this, args);
      // Clone response so we don't consume the stream
      const clone = response.clone();
      
      clone.text().then(text => {
        // Only try to parse if it looks like JSON
        if (text && text.trim().startsWith('{') || text.trim().startsWith('[')) {
          storeResponse(url, text, method);
        }
      }).catch(err => {});
      
      return response;
    } catch (e) {
      throw e;
    }
  };

  // Intercept XMLHttpRequest
  const XHR = XMLHttpRequest.prototype;
  const originalOpen = XHR.open;
  const originalSend = XHR.send;

  XHR.open = function(method, url) {
    this._method = method;
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XHR.send = function(body) {
    this.addEventListener('load', function() {
      if (this.responseType === '' || this.responseType === 'text') {
        const text = this.responseText;
        if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
           storeResponse(this._url, text, this._method);
        }
      } else if (this.responseType === 'json') {
        storeResponse(this._url, this.response, this._method);
      }
    });
    return originalSend.apply(this, arguments);
  };

  window.getScraperStatus = function() {
    console.log(`Captured ${window.__ONEPREP_RAW_DATA__.length} network responses.`);
    return window.__ONEPREP_RAW_DATA__;
  };

  window.downloadRawData = function() {
    if (window.__ONEPREP_RAW_DATA__.length === 0) {
      console.warn("No data captured yet! Try clicking around the app first.");
      return;
    }
    const dataStr = JSON.stringify(window.__ONEPREP_RAW_DATA__, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oneprep_raw_dump_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Download started!");
  };

  console.log("✅ OnePrep Network Interceptor installed!");
  console.log("-> Navigate through questions on the site.");
  console.log("-> Type getScraperStatus() to see count.");
  console.log("-> Type downloadRawData() to save.");
})();
