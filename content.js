if (location.href.includes("docs.google.com")) {
  setTimeout(() => {
    const text = document.body.innerText.slice(0,8000);
    if (text.length>300) {
      chrome.runtime.sendMessage({action:"fill", text});
    }
  }, 3000);
}