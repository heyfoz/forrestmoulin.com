// =============================================
// BACKGROUND SERVICE WORKER
// =============================================

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.type === 'GET_ALL_TABS') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      // Filter to only recordable tabs
      const filteredTabs = tabs.filter(t => 
        t.url && 
        ! t.url.startsWith('chrome://') && 
        !t.url.startsWith('chrome-extension://') &&
        !t.url.startsWith('about:') &&
        !t.url. startsWith('edge://') &&
        !t.url.startsWith('brave://')
      );
      sendResponse({ success: true, tabs: filteredTabs });
    });
    return true;
  }
  
  if (message.type === 'FOCUS_TAB') {
    chrome.tabs.update(message.tabId, { active: true }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log('Tab Recorder background loaded');