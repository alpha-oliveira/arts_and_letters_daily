const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const form = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("api-key");
const modelInput = document.getElementById("model");
const status = document.getElementById("status");
const removeKeyButton = document.getElementById("remove-key");

function showStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.error = String(isError);
}

chrome.storage.local.get(["groqApiKey", "groqModel"], (settings) => {
  if (chrome.runtime.lastError) {
    showStatus(chrome.runtime.lastError.message, true);
    return;
  }

  apiKeyInput.value = settings.groqApiKey || "";
  modelInput.value = settings.groqModel || DEFAULT_GROQ_MODEL;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim();

  if (!apiKey) {
    showStatus("Enter a Groq API key, or use Remove key to clear the saved key.", true);
    return;
  }

  if (!model) {
    showStatus("Enter a Groq model ID enabled for your account.", true);
    return;
  }

  chrome.storage.local.set({ groqApiKey: apiKey, groqModel: model }, () => {
    if (chrome.runtime.lastError) {
      showStatus(chrome.runtime.lastError.message, true);
      return;
    }

    showStatus("Settings saved in this browser.");
  });
});

removeKeyButton.addEventListener("click", () => {
  chrome.storage.local.remove("groqApiKey", () => {
    if (chrome.runtime.lastError) {
      showStatus(chrome.runtime.lastError.message, true);
      return;
    }

    apiKeyInput.value = "";
    showStatus("Saved API key removed.");
  });
});
