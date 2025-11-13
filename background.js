chrome.contextMenus.create({
  id: "sb",
  title: "Ask Study Buddy",
  contexts: ["selection"]
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === "fill" && message.text) {
    // Store the text in chrome.storage for the popup to retrieve
    chrome.storage.local.set({ 
      pendingText: message.text,
      pendingTimestamp: Date.now()
    });
    
    // Show badge notification
    if (sender.tab && sender.tab.id) {
      chrome.action.setBadgeText({ text: "1", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#4f46e5" });
    }
    
    sendResponse({ success: true });
    return true; // Keep channel open for async response
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sb" && info.selectionText) {
    // Store the text in chrome.storage for the popup to retrieve
    chrome.storage.local.set({ 
      pendingText: info.selectionText,
      pendingTimestamp: Date.now()
    });
    
    // Open the popup (user needs to click the extension icon)
    // Note: chrome.action.openPopup() doesn't work programmatically in MV3
    // So we'll use a badge to notify the user
    chrome.action.setBadgeText({ text: "1", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#4f46e5" });
  }
});