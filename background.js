// background.js
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchAndSummarize") {
    Promise.all([
      getGroqApiKey(),
      getGroqModel()
    ]).then(([apiKey, model]) => {
      return handleSummarization(request.url, request.groqApiKey || apiKey, request.groqModel || model || DEFAULT_GROQ_MODEL);
    }).then(result => sendResponse({
      success: true,
      summary: result.summary,
      title: result.title || request.title || "",
      source: result.source || getSourceFromUrl(request.url)
    }))
      .catch(error => sendResponse({
        success: false,
        error: error.message || String(error),
        title: request.title || "",
        source: getSourceFromUrl(request.url)
      }));

    return true;
  }

  return false;
});

async function getGroqApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["groqApiKey"], (result) => {
      resolve(result.groqApiKey || "");
    });
  });
}

async function getGroqModel() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["groqModel"], (result) => {
      resolve(result.groqModel || DEFAULT_GROQ_MODEL);
    });
  });
}

function stripHtmlToText(htmlText) {
  return htmlText
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getUrlTitle(url) {
  try {
    const parsedUrl = new URL(url);
    const slug = parsedUrl.pathname.split('/').filter(Boolean).pop();
    return slug
      ? decodeURIComponent(slug).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ")
      : parsedUrl.hostname;
  } catch (error) {
    return "Article";
  }
}

function getSourceFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch (error) {
    return "Unknown source";
  }
}

function extractPageSource(pageContent, url) {
  const metaTags = pageContent.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!key || !["og:site_name", "application-name"].includes(key.toLowerCase())) continue;

    const value = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const source = (value?.[1] || value?.[2] || value?.[3] || "").trim();
    if (source) return source.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"');
  }

  return getSourceFromUrl(url);
}

function extractPageTitle(pageContent, url) {
  const htmlTitle = pageContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const jinaTitle = pageContent.match(/^Title:\s*(.+)$/im)?.[1];
  const title = (htmlTitle || jinaTitle || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  return title || getUrlTitle(url);
}

function normalizeUrlForFetch(url) {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "mc_cid", "mc_eid", "dclid", "igshid", "ref", "src",
      "campaign", "source", "mkt_tok"
    ];

    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    parsed.hash = "";

    return parsed.toString();
  } catch (error) {
    return url;
  }
}

function isAccessBlockedPage(text) {
  const blockedPatterns = [
    "can’t access the article at that URL",
    "can't access the article at that URL",
    "I’m sorry, but I can’t access the article",
    "I'm sorry, but I can't access the article",
    "paste the text or provide a brief excerpt",
    "please paste the text"
  ];

  const lowered = text.toLowerCase();
  return blockedPatterns.some((pattern) => lowered.includes(pattern.toLowerCase()));
}

async function fetchWithFallbacks(url) {
  const normalizedUrl = normalizeUrlForFetch(url);
  const candidates = [
    normalizedUrl,
    `https://r.jina.ai/http://${normalizedUrl.replace(/^https?:\/\//i, "")}`,
    `https://r.jina.ai/http://r.jina.ai/http://${normalizedUrl.replace(/^https?:\/\//i, "")}`
  ];

  let lastError = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        credentials: "omit",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ALDailySummarizer/1.0)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const htmlText = await response.text();
      const cleanedText = stripHtmlToText(htmlText);

      if (isAccessBlockedPage(htmlText)) {
        throw new Error("This article blocks automated access. Paste the text or a brief excerpt instead.");
      }

      if (!cleanedText) {
        throw new Error("Empty page body");
      }

      return {
        text: cleanedText,
        title: extractPageTitle(htmlText, normalizedUrl),
        source: extractPageSource(htmlText, normalizedUrl)
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "Failed to fetch target web page. The site may block direct requests or cross-origin access.");
}

async function extractPageText(url) {
  try {
    return await fetchWithFallbacks(url);
  } catch (error) {
    try {
      const createdTab = await chrome.tabs.create({ url, active: false });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: createdTab.id },
        func: () => ({
          title: document.title,
          source: document.querySelector('meta[property="og:site_name"], meta[name="application-name"]')?.content || location.hostname.replace(/^www\./i, ""),
          text: document.body ? document.body.innerText : ""
        })
      });

      await chrome.tabs.remove(createdTab.id);

      if (result?.result?.text?.trim()) {
        return {
          text: result.result.text.trim(),
          title: result.result.title || getUrlTitle(url),
          source: result.result.source || getSourceFromUrl(url)
        };
      }
    } catch (tabError) {
      // Ignore tab-based fallback errors and surface the original fetch error.
    }

    throw new Error(error.message || "Failed to fetch target web page. The site may block direct requests or cross-origin access.");
  }
}

async function summarizeWithGroq(text, apiKey, modelName) {
  if (!apiKey) {
    throw new Error("Groq API key is missing. Open the extension Options page and enter your key.");
  }

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName || DEFAULT_GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a precise research assistant. Summarize the provided text into 3 concise, highly informative sentences capturing the core arguments and thesis."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 700
    })
  });

  const raw = await groqResponse.text();

  if (!groqResponse.ok) {
    let errorPayload = { error: { message: "Groq API error" } };
    try {
      errorPayload = JSON.parse(raw);
    } catch (error) {
      // Ignore parse errors and fall back to the default message.
    }

    throw new Error(errorPayload.error?.message || "Groq API error");
  }

  const data = JSON.parse(raw);
  return data.choices?.[0]?.message?.content || "No summary returned.";
}

async function handleSummarization(url, apiKey, modelName) {
  const page = await extractPageText(url);
  const truncatedText = page.text.substring(0, 12000);
  const summary = await summarizeWithGroq(truncatedText, apiKey, modelName);
  return { summary, title: page.title, source: page.source };
}