const connectionStatus = document.querySelector("#connection-status");
const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const chatMessages = document.querySelector("#chat-messages");
const chatStatus = document.querySelector("#chat-status");
const welcomePanel = document.querySelector("#welcome-panel");
const newChatButton = document.querySelector("#new-chat-button");
const menuButton = document.querySelector("#menu-button");
const sidebar = document.querySelector("#sidebar");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");

function showConversation() {
  welcomePanel.hidden = true;
  chatMessages.hidden = false;
}

async function checkBackendConnection() {
  try {
    const response = await fetch("/api/health");

    if (!response.ok) {
      throw new Error(`The server returned status ${response.status}.`);
    }

    const data = await response.json();

    if (data.status !== "ok") {
      throw new Error("The backend returned an unexpected response.");
    }

    connectionStatus.textContent = "Connected — the backend is working.";
    connectionStatus.classList.add("connected");
    connectionStatus.classList.remove("error");
  } catch (error) {
    connectionStatus.textContent =
      "Could not connect to the backend. Check that the server is running.";
    connectionStatus.classList.add("error");
    console.error("Backend connection check failed:", error);
  }
}

function appendInlineMarkdown(parent, text) {
  const inlinePattern =
    /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const token = match[0];
    const start = match.index;

    parent.append(document.createTextNode(text.slice(lastIndex, start)));

    if (token.startsWith("[") && token.includes("](")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      const link = document.createElement("a");
      link.href = linkMatch[2];
      link.textContent = linkMatch[1];
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      parent.append(link);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else if (token.startsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      parent.append(code);
    } else {
      const emphasis = document.createElement("em");
      emphasis.textContent = token.slice(1, -1);
      parent.append(emphasis);
    }

    lastIndex = start + token.length;
  }

  parent.append(document.createTextNode(text.slice(lastIndex)));
}

function renderMarkdown(container, markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.append(code);
      container.append(pre);
      continue;
    }

    if (/^(---+|___+|\*\*\*+)$/.test(line)) {
      container.append(document.createElement("hr"));
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const heading = document.createElement(`h${headingMatch[1].length}`);
      appendInlineMarkdown(heading, headingMatch[2]);
      container.append(heading);
      index += 1;
      continue;
    }

    const listMatch = line.match(/^([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const isOrderedList = /^\d/.test(listMatch[1]);
      const list = document.createElement(isOrderedList ? "ol" : "ul");

      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(/^([-*+]|\d+[.)])\s+(.+)$/);
        if (!itemMatch || /^\d/.test(itemMatch[1]) !== isOrderedList) {
          break;
        }

        const item = document.createElement("li");
        appendInlineMarkdown(item, itemMatch[2]);
        list.append(item);
        index += 1;
      }

      container.append(list);
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index].trim();
      if (
        !nextLine ||
        nextLine.startsWith("```") ||
        /^(---+|___+|\*\*\*+)$/.test(nextLine) ||
        /^(#{1,6})\s+/.test(nextLine) ||
        /^([-*+]|\d+[.)])\s+/.test(nextLine)
      ) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    container.append(paragraph);
  }
}

function addMessage(label, message, className) {
  showConversation();

  const messageElement = document.createElement("article");
  messageElement.classList.add("message", className);

  const labelElement = document.createElement("strong");
  labelElement.classList.add("message-label");
  labelElement.textContent = label;
  messageElement.append(labelElement);

  const contentElement = document.createElement("div");
  contentElement.classList.add("message-content");

  if (className === "message-assistant") {
    renderMarkdown(contentElement, message);
  } else {
    contentElement.textContent = message;
  }

  messageElement.append(contentElement);

  chatMessages.append(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageElement;
}

function addLoadingMessage() {
  showConversation();

  const loadingMessage = document.createElement("article");
  loadingMessage.classList.add("message", "message-assistant", "message-loading");
  loadingMessage.setAttribute("aria-label", "Assistant is thinking");

  const label = document.createElement("strong");
  label.classList.add("message-label");
  label.textContent = "Study assistant";

  const text = document.createElement("span");
  text.textContent = "Putting together a helpful answer";

  const dots = document.createElement("span");
  dots.classList.add("loading-dots");
  dots.setAttribute("aria-hidden", "true");

  for (let dotNumber = 0; dotNumber < 3; dotNumber += 1) {
    dots.append(document.createElement("span"));
  }

  loadingMessage.append(label, text, dots);
  chatMessages.append(loadingMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return loadingMessage;
}

function startNewChat() {
  chatMessages.replaceChildren();
  chatMessages.hidden = true;
  welcomePanel.hidden = false;
  chatStatus.textContent = "Your AI study partner is ready when you are.";
  messageInput.value = "";
  messageInput.focus();
  closeSidebar();
}

function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();

  if (!message) {
    chatStatus.textContent = "Type a question before sending.";
    messageInput.focus();
    return;
  }

  addMessage("You", message, "message-user");
  messageInput.value = "";
  messageInput.style.height = "auto";
  sendButton.disabled = true;
  sendButton.textContent = "Sending...";
  chatStatus.textContent = "Working on a concise answer...";
  const loadingMessage = addLoadingMessage();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const contentType = response.headers.get("content-type") || "";
    let data = {};

    if (contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : `The server returned status ${response.status}.`;

      throw new Error(detail);
    }

    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("The backend returned an empty or unexpected response.");
    }

    loadingMessage.remove();
    addMessage("Assistant", data.reply, "message-assistant");
    chatStatus.textContent = "Reply received.";
  } catch (error) {
    loadingMessage.remove();
    addMessage(
      "Error",
      error.message || "Could not send your message. Check that the server is running.",
      "message-error",
    );
    chatStatus.textContent = "The message could not be answered.";
    console.error("Chat request failed:", error);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send";
    messageInput.focus();
  }
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.prompt;
    messageInput.focus();
    messageInput.setSelectionRange(
      messageInput.value.length,
      messageInput.value.length,
    );
    messageInput.dispatchEvent(new Event("input"));
    closeSidebar();
  });
});

newChatButton.addEventListener("click", startNewChat);
menuButton.addEventListener("click", () => {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});
sidebarBackdrop.addEventListener("click", closeSidebar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
  }
});

checkBackendConnection();