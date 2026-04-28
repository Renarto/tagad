// ============================================
// SOURCE-CHECKER.JS - Source credibility checks
// ============================================
// Checks: attribution, hyperlinks quality, wire services, anonymous sources, image captions

// Evaluates the quality and quantity of sources cited in the article
async function checkSources(searchText, articleElement, weights) {
  let rawScore = 0;               // Cumulative risk score from source checks
  let factors = [];               // Factor objects to display in popup
  let sourceLinks = [];           // Collection of detected external source links
  let imageSourceCaptions = [];   // Collection of image credit/caption text found

  // --- Check 1: Direct Attribution Phrases ---
  // Regex matches common journalistic attribution phrases
  const attributionRegex = /\baccording to\b|\breported by\b|\breports? say\b|\bwas quoted as saying\b|\bsaid [A-Z][a-z]+/gi;
  const attrMatches = (searchText.match(attributionRegex) || []);
  if (attrMatches.length) {
    factors.push({
      id: 'attribution',
      label: 'Direct attribution present',
      weight: weights.attribution || 1,
      triggered: false,                           // Good signal — no issue
      details: attrMatches.slice(0, 3).join('; ') // Show up to 3 examples in the popup
    });
    highlightPattern(articleElement, attributionRegex, 'attribution'); // Highlight in page
  } else {
    rawScore += weights.attribution || 1; // No attribution = higher risk
    factors.push({
      id: 'attribution',
      label: 'Direct attribution present',
      weight: weights.attribution || 1,
      triggered: true  // Issue: no attribution phrases found
    });
  }

  // --- Check 2: Hyperlinks and External Source Quality ---
  // Get all anchor tags that have an href attribute within the article
  const anchors = Array.from(articleElement.querySelectorAll('a[href]'));
  
  // Helper: Returns true if a link points to an authoritative/credible source
  const isAuthoritativeLink = (a) =>
    /\.gov\b|\.edu\b|doi\.org|\.pdf|apnews|reuters|bbc\.co|nytimes|washingtonpost|theguardian/i
    .test(a.href || a.textContent);
  
  const seenHosts = new Set(); // Track already-added hosts to avoid duplicates

  // Priority 1: Collect links to authoritative sources (.gov, .edu, major news orgs)
  const authoritative = anchors.filter(a => isAuthoritativeLink(a) && a.href);
  authoritative.forEach(a => {
    try {
      // Normalize the link's hostname for deduplication
      const host = normalizeHost(a.hostname || (new URL(a.href)).hostname);
      // Only add if it's external (not the current site) and not already added
      if (host !== normalizeHost(window.location.hostname || '') && !seenHosts.has(host)) {
        seenHosts.add(host);
        const linkText = (a.innerText || a.title || a.href).trim(); // Best available label
        if (linkText && linkText.length > 2 && linkText.length < 200) {
          sourceLinks.push({ href: a.href, text: linkText, host: host, type: 'authoritative' });
          a.setAttribute('data-reason-id', 'links');               // Tag for "Go" button scrolling
          a.classList.add('nd-highlight', 'nd-links');             // Apply highlight style
        }
      }
    } catch (e) { /* skip links with malformed URLs */ }
  });

  // Priority 2: Links that appear near attribution phrases in the text
  const attributionContextRegex = /(according to|reported by|said|quoted|via|source:|source link)/i;
  const linksNearAttribution = anchors.filter(a => {
    try {
      const parent = a.parentElement;
      const text = (parent.innerText || a.innerText || '').toLowerCase();
      return attributionContextRegex.test(text); // Does surrounding text suggest it's a citation?
    } catch (e) { return false; }
  });
  
  linksNearAttribution.forEach(a => {
    try {
      const host = normalizeHost(a.hostname || (new URL(a.href)).hostname);
      if (host !== normalizeHost(window.location.hostname || '') && !seenHosts.has(host)) {
        seenHosts.add(host);
        const linkText = (a.innerText || a.title || a.href).trim();
        if (linkText && linkText.length > 2 && linkText.length < 200) {
          sourceLinks.push({ href: a.href, text: linkText, host: host, type: 'cited' });
          a.setAttribute('data-reason-id', 'links');
          a.classList.add('nd-highlight', 'nd-links');
        }
      }
    } catch (e) { /* skip */ }
  });

  // Priority 3: Any other external links with meaningful link text (not generic "click here")
  const otherLinks = anchors.filter(a => 
    a.href && 
    !/click here|read more|view|continue|next|more info/i.test((a.innerText || '').toLowerCase())
  );
  
  // Only take first 5 to avoid overwhelming the source list with navigation links
  otherLinks.slice(0, 5).forEach(a => {
    try {
      const host = normalizeHost(a.hostname || (new URL(a.href)).hostname);
      if (host !== normalizeHost(window.location.hostname || '') && !seenHosts.has(host)) {
        seenHosts.add(host);
        const linkText = (a.innerText || a.title || a.href).trim();
        if (linkText && linkText.length > 2 && linkText.length < 200 && sourceLinks.length < 10) {
          sourceLinks.push({ href: a.href, text: linkText, host: host, type: 'external' });
          a.setAttribute('data-reason-id', 'links');
          a.classList.add('nd-highlight', 'nd-links');
        }
      }
    } catch (e) { /* skip */ }
  });
  
  const externalCount = sourceLinks.length; // Total distinct external sources found

  if (externalCount < 1) {
    // No external sources found — big red flag for credibility
    rawScore += weights.links;
    factors.push({
      id: 'links',
      label: 'Very few sources/links',
      weight: weights.links,
      triggered: true,
      details: `Found ${externalCount} links`
    });
  } else {
    // Check if any of the found links are authoritative
    const hasAuthoritative = sourceLinks.some(s => s.type === 'authoritative');
    if (hasAuthoritative) {
      factors.push({
        id: 'links',
        label: 'Sources/links found (authoritative present)',
        weight: weights.links,
        triggered: false,
        details: `Found ${externalCount} external links, including authoritative sources`,
        links: sourceLinks
      });
    } else {
      factors.push({
        id: 'links',
        label: 'Sources/links found',
        weight: weights.links,
        triggered: false,
        details: `Found ${externalCount} external links`,
        links: sourceLinks
      });
    }
  }

  // --- Check 3: Wire Service Detection ---
  // Presence of AP, Reuters, etc. is generally a positive credibility signal
  const wireRegex = /\b(Associated Press|AP\b|Reuters|AFP|Agence France[-\s]?Presse|Bloomberg)\b/i;
  const wireMatch =
    wireRegex.test(searchText) ||                                         // Found in text
    anchors.some(a => /apnews|politifact|reuters|afp\.|bloomberg/i.test(a.href || '')); // Or in a link href

  if (wireMatch) {
    // Wire service attribution is a POSITIVE signal — we set triggered: true to show the "Go" button
    factors.push({
      id: 'wire',
      label: 'Wire service attribution detected',
      weight: weights.wire || 1,
      triggered: true  // 'triggered' here means "found" (positive for wire services)
    });
    highlightPattern(articleElement, wireRegex, 'wire'); // Highlight wire service mention
  } else {
    factors.push({
      id: 'wire',
      label: 'Wire service attribution detected',
      weight: weights.wire || 1,
      triggered: false  // No wire service mentioned
    });
  }

  // --- Check 4: Anonymous or Unattributed Sources ---
  // These phrases indicate information from unnamed sources — a credibility concern
  const anonPatterns = [               
    'a source familiar with',  // Generic anonymous source
    'an unnamed source',       // Explicitly unnamed
    'an anonymous source',     // Explicitly anonymous
    'sources said',            // Plural vague attribution
    'a source said',           // Singular vague attribution
    'according to sources'     // Vague sourcing
  ];

  const lowerText = searchText.toLowerCase(); // Lowercase once for all pattern checks
  const anonFound = anonPatterns.some(p => lowerText.includes(p)); // Check any pattern matches

  if (anonFound) {
    rawScore += weights.anonymous || 1; // Anonymous sources = higher risk score
    factors.push({
      id: 'anonymous',
      label: 'Anonymous/unattributed sources present',
      weight: weights.anonymous || 1,
      triggered: true,
      // Show which specific anonymous patterns were found (up to 3)
      details: anonPatterns.filter(p => lowerText.includes(p)).slice(0, 3).join('; ')
    });
    // Create a combined regex from all matched patterns to highlight them in the page
    const anonRegex = new RegExp('(' + anonPatterns.join('|') + ')', 'gi');
    highlightPattern(articleElement, anonRegex, 'anonymous');
  } else {
    factors.push({
      id: 'anonymous',
      label: 'Anonymous/unattributed sources present',
      weight: weights.anonymous || 1,
      triggered: false // No anonymous sources — good signal
    });
  }

  // --- Check 5: Image Captions and Photo Credit Lines ---
  // Articles that properly credit images demonstrate editorial accountability
  try {
    // Look for standard figcaption and credit elements
    const figcaps = Array.from(articleElement.querySelectorAll(
      'figcaption, .caption, .photo-credit, .image-credit, .img-caption'
    ));

    figcaps.forEach(fc => {
      const t = (fc.innerText || '').trim();
      if (t) {
        // Only count it as a source credit if it contains source/photo/credit keywords
        if (/source:|photo:|image:|credit:|via\b/i.test(t)) {
          imageSourceCaptions.push(t);                         // Store caption text
          fc.setAttribute('data-reason-id', 'imageSource');    // Tag for scrolling
          fc.classList.add('nd-highlight', 'nd-imageSource');  // Apply highlight
        }
      }
    });

    // Also check <img> alt text and sibling elements for credit information
    const imgs = Array.from(articleElement.querySelectorAll('img'));
    imgs.slice(0, 20).forEach(img => { // Limit to 20 images to avoid performance issues
      const alt = (img.alt || '').trim();
      if (alt && /photo:|image:|credit:|via\b|source:/i.test(alt)) {
        imageSourceCaptions.push(alt);
        img.setAttribute('data-reason-id', 'imageSource');
        img.classList.add('nd-highlight', 'nd-imageSource');
      }

      // Check the element immediately after the image, or a .caption sibling
      const sib = img.nextElementSibling ||
                  (img.parentElement && img.parentElement.querySelector('.caption'));
      if (sib && sib.innerText && /source:|photo:|credit:|via\b/i.test(sib.innerText)) {
        imageSourceCaptions.push(sib.innerText.trim());
        sib.setAttribute('data-reason-id', 'imageSource');
        sib.classList.add('nd-highlight', 'nd-imageSource');
      }
    });
  } catch (e) { /* ignore any DOM errors during image scanning */ }

  if (imageSourceCaptions.length) {
    factors.push({
      id: 'imageSource',
      label: 'Image captions/source credits found',
      weight: weights.imageSource || 1,
      triggered: false,                                                     // Good signal
      details: imageSourceCaptions.slice(0, 3).join(' | '),                // Show first 3
      captions: imageSourceCaptions.slice(0, 5)                            // Store up to 5
    });
  } else {
    // No image credits found (not necessarily bad, so not scored)
    factors.push({
      id: 'imageSource',
      label: 'Image captions/source credits found',
      weight: weights.imageSource || 1,
      triggered: false
    });
  }

  // Return everything to content.js for final score assembly
  return { rawScore, factors, sourceLinks, imageSourceCaptions };
}
