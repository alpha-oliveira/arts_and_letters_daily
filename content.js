// content.js
console.log("ALDaily Summarizer loaded.");

// Find all primary links within the content body of ALDaily
const links = document.querySelectorAll('.box a, .entry a, p a'); // Adjust selector based on ALDaily's exact layout if needed

function getPageName(link) {
  const url = new URL(link.href);
  const genericLinkText = /^(more|read more|continue reading)[\s.…»›>]*$/i;
  const linkName = (link.getAttribute('title') || link.textContent).trim();

  if (linkName && !genericLinkText.test(linkName)) {
    return linkName;
  }

  const slug = url.pathname.split('/').filter(Boolean).pop();
  if (!slug) return url.hostname;

  try {
    return decodeURIComponent(slug)
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[-_]+/g, " ");
  } catch (error) {
    return slug.replace(/[-_]+/g, " ");
  }
}

links.forEach(link => {
  // Prevent duplicate buttons
  if (link.dataset.summarizerInjected) return;
  link.dataset.summarizerInjected = "true";

  // Create a small inline "Summarize" button
  const btn = document.createElement('button');
  btn.innerText = "✨ AI Summary";
  btn.style.marginLeft = "8px";
  btn.style.fontSize = "11px";
  btn.style.padding = "2px 6px";
  btn.style.cursor = "pointer";
  btn.style.border = "1px solid #ccc";
  btn.style.borderRadius = "4px";
  btn.style.background = "#f9f9f9";
  btn.style.color = "#333";

  btn.addEventListener('click', async (e) => {
    e.preventDefault(); // Don't actually navigate away yet
    e.stopPropagation();

    const targetUrl = link.href;
    const pageName = getPageName(link);
    const sourceName = new URL(targetUrl).hostname.replace(/^www\./i, "");
    
    // Create or locate a container for the summary text below the link
    let summaryBox = link.parentNode.querySelector('.ai-summary-result');
    if (!summaryBox) {
      summaryBox = document.createElement('div');
      summaryBox.className = 'ai-summary-result';
      summaryBox.style.marginTop = "6px";
      summaryBox.style.padding = "8px 12px";
      summaryBox.style.fontSize = "13px";
      summaryBox.style.background = "#f0f4f8";
      summaryBox.style.borderLeft = "3px solid #0066cc";
      summaryBox.style.color = "#333";
      summaryBox.style.borderRadius = "0 4px 4px 0";
      summaryBox.innerText = `Page: ${pageName}\nSource: ${sourceName}\nFetching and summarizing via Groq...`;
      link.parentNode.appendChild(summaryBox);
    } else {
      summaryBox.style.display = "block";
      summaryBox.innerText = `Page: ${pageName}\nSource: ${sourceName}\nFetching and summarizing via Groq...`;
    }

    // Send message to background script to fetch and summarize
    chrome.runtime.sendMessage(
      { action: "fetchAndSummarize", url: targetUrl, title: pageName },
      (response) => {
        if (chrome.runtime.lastError) {
          summaryBox.innerText = `Page: ${pageName}\nSource: ${sourceName}\nSummary unavailable: ${chrome.runtime.lastError.message}`;
        } else if (response?.success && response.summary?.trim()) {
          summaryBox.innerText = `Page: ${response.title || pageName}\nSource: ${response.source || sourceName}\n\n${response.summary}`;
        } else {
          summaryBox.innerText = `Page: ${response?.title || pageName}\nSource: ${response?.source || sourceName}\nSummary unavailable: ${response?.error || "No summary returned."}`;
        }
      }
    );
  });

  link.parentNode.insertBefore(btn, link.nextSibling);
});