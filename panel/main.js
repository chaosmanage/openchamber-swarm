(() => {
  // node_modules/@openchamber/sdk/dist/api-version.js
  var OPENCHAMBER_SDK_CHANNEL = "openchamber.sdk";
  var OPENCHAMBER_SDK_API_VERSION = 1;
  // node_modules/@openchamber/sdk/dist/scrollbar-style.js
  var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
  var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
  function installGuestScrollbarActivity(doc) {
    const root = doc.documentElement;
    if (root.hasAttribute("data-oc-scrollbar-activity"))
      return;
    root.setAttribute("data-oc-scrollbar-activity", "");
    const timers = new WeakMap;
    doc.addEventListener("scroll", (event) => {
      const target = event.target === doc ? root : event.target;
      if (!(target instanceof Element))
        return;
      if (!target.hasAttribute("data-oc-scrolling"))
        target.setAttribute("data-oc-scrolling", "");
      const pending = timers.get(target);
      if (pending !== undefined)
        clearTimeout(pending);
      timers.set(target, setTimeout(() => {
        timers.delete(target);
        target.removeAttribute("data-oc-scrolling");
      }, 1000));
    }, { capture: true, passive: true });
  }
  var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;
  // node_modules/@openchamber/sdk/dist/workspace.js
  var GUEST_STORAGE_KEY_MAX = 128;
  var GUEST_STORAGE_VALUE_BYTES = 65536;
  // node_modules/@openchamber/sdk/dist/shells.js
  var GUEST_SHELL_ID_MAX = 128;
  var GUEST_SHELL_OUTPUT_TAIL_MAX = 65536;
  // node_modules/@openchamber/sdk/dist/microphone.js
  var GUEST_MICROPHONE_SAMPLE_RATE_MIN = 8000;
  var GUEST_MICROPHONE_SAMPLE_RATE_MAX = 192000;
  var GUEST_MICROPHONE_OPEN_TIMEOUT_MS = 120000;
  var createSampleQueue = (capacity) => {
    const chunks = [];
    let offset = 0;
    let queued = 0;
    return {
      push: (samples) => {
        chunks.push(samples);
        queued += samples.length;
        while (queued - offset > capacity && chunks.length > 1) {
          const dropped = chunks.shift();
          queued -= dropped?.length ?? 0;
          offset = 0;
        }
      },
      pull: (out) => {
        let written = 0;
        while (written < out.length && chunks.length > 0) {
          const head = chunks[0];
          const count = Math.min(out.length - written, head.length - offset);
          out.set(head.subarray(offset, offset + count), written);
          written += count;
          offset += count;
          if (offset >= head.length) {
            chunks.shift();
            queued -= head.length;
            offset = 0;
          }
        }
        out.fill(0, written);
      },
      clear: () => {
        chunks.length = 0;
        offset = 0;
        queued = 0;
      },
      get size() {
        return queued - offset;
      }
    };
  };
  // node_modules/@openchamber/sdk/dist/status-controls.js
  var GUEST_STATUS_CONTROLS_MAX = 4;
  var GUEST_STATUS_CONTROL_ID = /^[a-z][a-z0-9-]{0,39}$/;
  var GUEST_STATUS_CONTROL_LABEL_MAX = 60;
  var GUEST_STATUS_CONTROL_OPTIONS_MAX = 16;
  var GUEST_STATUS_CONTROL_VALUE_MAX = 80;
  var isControlObject = (value) => Object(value) === value && !Array.isArray(value);
  var hasOnlyKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key));
  var isLabel = (value) => String(value) === value && value.length >= 1 && value.length <= GUEST_STATUS_CONTROL_LABEL_MAX;
  var isValue = (value) => String(value) === value && value.length >= 1 && value.length <= GUEST_STATUS_CONTROL_VALUE_MAX;
  var isGuestStatusControls = (controls) => {
    if (!Array.isArray(controls) || controls.length > GUEST_STATUS_CONTROLS_MAX)
      return false;
    const ids = new Set;
    for (const control of controls) {
      if (!isControlObject(control) || !GUEST_STATUS_CONTROL_ID.test(control.id) || !isLabel(control.label))
        return false;
      if (control.disabled !== undefined && control.disabled !== true && control.disabled !== false)
        return false;
      if (ids.has(control.id))
        return false;
      ids.add(control.id);
      if (control.kind === "button") {
        if (!hasOnlyKeys(control, ["kind", "id", "label", "disabled"]))
          return false;
        continue;
      }
      if (control.kind !== "select" || !hasOnlyKeys(control, ["kind", "id", "label", "value", "options", "disabled"]))
        return false;
      if (!isValue(control.value) || !Array.isArray(control.options) || control.options.length < 1 || control.options.length > GUEST_STATUS_CONTROL_OPTIONS_MAX)
        return false;
      const values = new Set;
      for (const option of control.options) {
        if (!isControlObject(option) || !hasOnlyKeys(option, ["value", "label"]) || !isValue(option.value) || !isLabel(option.label) || values.has(option.value))
          return false;
        values.add(option.value);
      }
      if (!values.has(control.value))
        return false;
    }
    return true;
  };
  // node_modules/@openchamber/sdk/dist/manifest.js
  var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
  var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
  var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);
  // node_modules/@openchamber/sdk/dist/session-events.js
  var GUEST_SESSION_EVENT_TYPES = [
    "turn-finished",
    "turn-failed",
    "permission-asked",
    "question-asked",
    "turn-started",
    "session-created",
    "session-archived",
    "session-deleted"
  ];
  var SESSION_EVENTS_IDLE_MS = 10 * 60000;
  var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);
  // node_modules/@openchamber/sdk/dist/service-host.js
  var SERVICE_SCHEDULE_IDLE_MS = 10 * 60000;
  var MENTIONS_IDLE_MS = 10 * 60000;
  // node_modules/@openchamber/sdk/dist/file-editor.js
  var GUEST_FILE_EDITOR_CONTENT_MAX = 20000000;
  var GUEST_FILE_EDITOR_VERSION_MAX = 256;
  var patternExpressions = new Map;
  var fileEditorPayloadSize = (value) => ("bytes" in value) ? value.bytes.byteLength : value.content.length;
  var sameFileEditorDocument = (left, right) => {
    if (left.path !== right.path || left.readOnly !== right.readOnly)
      return false;
    if (left.encoding === "text" || right.encoding === "text") {
      return left.encoding === "text" && right.encoding === "text" && left.content === right.content;
    }
    if (left.bytes.byteLength !== right.bytes.byteLength)
      return false;
    for (let index = 0;index < left.bytes.byteLength; index += 1) {
      if (left.bytes[index] !== right.bytes[index])
        return false;
    }
    return true;
  };
  // node_modules/@openchamber/sdk/dist/popover.js
  var GUEST_POPOVER_ID = /^[A-Za-z0-9_-]{1,80}$/;
  var GUEST_POPOVER_COORDINATE_MAX = 1e5;
  var GUEST_POPOVER_WIDTH_MIN = 160;
  var GUEST_POPOVER_WIDTH_MAX = 640;
  var GUEST_POPOVER_HEIGHT_MIN = 48;
  var GUEST_POPOVER_HEIGHT_MAX = 480;
  var GUEST_POPOVER_DATA_MAX = 16000;
  var GUEST_POPOVER_DATA_DEPTH_MAX = 32;
  var GUEST_POPOVER_SIDES = ["left", "right", "top", "bottom"];
  var hasBoundedJsonTree = (value, depth = 0, budget = { remaining: GUEST_POPOVER_DATA_MAX }) => {
    if (--budget.remaining < 0 || depth >= GUEST_POPOVER_DATA_DEPTH_MAX)
      return false;
    if (value === null)
      return true;
    const children = Array.isArray(value) ? value : Object(value) === value ? Object.values(value) : [];
    for (const item of children) {
      if (!hasBoundedJsonTree(item, depth + 1, budget))
        return false;
    }
    return true;
  };
  var isFiniteJson = (value) => {
    if (value === null || value === true || value === false)
      return true;
    if (Array.isArray(value))
      return Object.keys(value).every((key) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length) && value.every(isFiniteJson);
    if (Object(value) === value) {
      const prototype = Object.getPrototypeOf(value);
      return (prototype === null || prototype === Object.prototype) && Object.values(value).every(isFiniteJson);
    }
    return String(value) === value || Number.isFinite(value);
  };
  var isGuestPopoverRequest = (request) => {
    try {
      if (String(request.id) !== request.id || !GUEST_POPOVER_ID.test(request.id) || !Number.isFinite(request.anchor.x) || Math.abs(request.anchor.x) > GUEST_POPOVER_COORDINATE_MAX || !Number.isFinite(request.anchor.y) || Math.abs(request.anchor.y) > GUEST_POPOVER_COORDINATE_MAX || !Number.isFinite(request.anchor.width) || !Number.isFinite(request.anchor.height) || request.anchor.width <= 0 || request.anchor.height <= 0 || request.anchor.width > GUEST_POPOVER_COORDINATE_MAX || request.anchor.height > GUEST_POPOVER_COORDINATE_MAX || !Number.isInteger(request.width) || request.width < GUEST_POPOVER_WIDTH_MIN || request.width > GUEST_POPOVER_WIDTH_MAX || !Number.isInteger(request.height) || request.height < GUEST_POPOVER_HEIGHT_MIN || request.height > GUEST_POPOVER_HEIGHT_MAX || request.side !== undefined && !GUEST_POPOVER_SIDES.includes(request.side) || request.focus !== undefined && request.focus !== true && request.focus !== false || !hasBoundedJsonTree(request.data) || !isFiniteJson(request.data))
        return false;
      return JSON.stringify(request.data).length <= GUEST_POPOVER_DATA_MAX;
    } catch {
      return false;
    }
  };

  // node_modules/@openchamber/sdk/dist/navigation.js
  var GUEST_COMMIT_SHA = /^[0-9a-f]{7,64}$/i;
  var isGuestCommitSha = (value) => GUEST_COMMIT_SHA.test(value);
  var GUEST_WALKTHROUGH_BASE_MAX = 255;
  var guestNavigationCalls = (request, nextId, refuse) => ({
    openCommit: (sha) => isGuestCommitSha(sha) ? request({ channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION, type: "open-commit", id: nextId(), payload: { sha } }) : refuse("Commit id must be 7 to 64 hex characters."),
    openWalkthrough: ({ base }) => {
      const trimmed = base.trim();
      if (!trimmed || trimmed.length > GUEST_WALKTHROUGH_BASE_MAX)
        return refuse(`Base must contain 1 to ${GUEST_WALKTHROUGH_BASE_MAX} characters.`);
      return request({ channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION, type: "open-walkthrough", id: nextId(), payload: { base: trimmed } });
    }
  });

  // node_modules/@openchamber/sdk/dist/contract.js
  var GUEST_BLOCK_ANSWER_MAX = 2000;
  var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
  var isStartSessionResult = (value) => Boolean(value && "sessionId" in value);
  var isPromptResult = (value) => Boolean(value && "sent" in value && !("sessionId" in value));
  var GUEST_TOAST_MAX = 500;
  var GUEST_CLIPBOARD_TEXT_MAX = 32000;
  var GUEST_COMPOSE_TEXT_MAX = 16000;
  var GUEST_ATTACH_ID_MAX = 128;
  var GUEST_ATTACH_TITLE_MAX = 200;
  var GUEST_ATTACH_URL_MAX = 2000;
  var GUEST_ATTACH_TEXT_MAX = 16000;
  var GUEST_ATTACH_AUTHOR_MAX = 80;
  var GUEST_ATTACH_BRANCH_MAX = 200;
  var GUEST_ATTACH_DATA_MAX = 16000;
  var GUEST_REQUEST_PATH_MAX = 2000;
  var GUEST_REQUEST_TIMEOUT_MS = 20000;
  var GUEST_FILE_PATH_MAX = 1024;
  var GUEST_FILE_CONTENT_MAX = 2000000;
  var GUEST_GENERATE_PROMPT_MAX = 64000;
  var GUEST_GENERATE_SYSTEM_MAX = 8000;
  var GUEST_GENERATE_OUTPUT_TOKENS_MAX = 4000;
  var GUEST_GENERATE_TIMEOUT_MS = 960000;
  var GUEST_GENERATE_LATE_KEEP_MS = 60 * 60000;
  var GUEST_BADGE_MAX = 999;
  var GUEST_FRAME_HEIGHT_MAX = 1e4;
  var GUEST_RESOLVE_ERROR_MAX = 500;
  var HOST_REQUEST_ERROR_CODES = [
    "HOST_UNAVAILABLE",
    "HOST_TIMEOUT",
    "HOST_REJECTED",
    "DISCONNECTED",
    "DISABLED",
    "BAD_PATH",
    "NO_INTEGRATION",
    "NO_SERVICE",
    "SERVICE_FAILED",
    "REQUEST_FAILED",
    "RESPONSE_TOO_LARGE",
    "NO_SESSION",
    "SESSION_BUSY",
    "NOT_GRANTED",
    "NO_DIRECTORY",
    "NOT_FOUND",
    "FILE_TOO_LARGE",
    "DENIED",
    "NO_MODEL",
    "MODEL_FAILED",
    "UNSUPPORTED"
  ];
  var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
  var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
  var isHostRequestErrorCode = (value) => hostRequestErrorCodeSet.has(value);
  var resolveHostRequestErrorCode = (value) => value && isHostRequestErrorCode(value) ? value : "HOST_REJECTED";
  var isJsonValue = (value) => {
    if (value === undefined)
      return false;
    if (value === null || value === true || value === false)
      return true;
    if (String(value) === value)
      return true;
    if (Number(value) === value)
      return Number.isFinite(value);
    if (Array.isArray(value))
      return value.every(isJsonValue);
    if (Object(value) === value)
      return Object.values(value).every(isJsonValue);
    return false;
  };
  var isAttachData = (value) => isJsonValue(value) && JSON.stringify(value).length <= GUEST_ATTACH_DATA_MAX;
  var clampBranch = (value) => value?.trim().slice(0, GUEST_ATTACH_BRANCH_MAX) ?? "";
  var clampAttachRequest = (request) => {
    const id = request.id.trim().slice(0, GUEST_ATTACH_ID_MAX);
    const title = request.title.trim().slice(0, GUEST_ATTACH_TITLE_MAX);
    const url = request.url.trim().slice(0, GUEST_ATTACH_URL_MAX);
    const text = request.text?.trim().slice(0, GUEST_ATTACH_TEXT_MAX);
    const author = request.author?.trim().slice(0, GUEST_ATTACH_AUTHOR_MAX);
    const kind = request.kind === "pull" ? "pull" : "issue";
    const next = {
      providerId: request.providerId.trim(),
      id,
      title: title || id,
      url,
      kind
    };
    if (text) {
      next.text = text;
    }
    if (author) {
      next.author = author;
    }
    if (kind === "pull") {
      const head = clampBranch(request.branches?.head);
      const base = clampBranch(request.branches?.base);
      if (head && base) {
        next.branches = { head, base };
      }
    }
    if (isAttachData(request.data)) {
      next.data = request.data;
    }
    return next;
  };
  var clampStartSessionRequest = (request) => {
    const next = clampAttachRequest(request);
    if (request.projectId)
      next.projectId = request.projectId;
    if (request.navigation)
      next.navigation = request.navigation;
    if (request.worktree) {
      next.worktree = request.worktree;
    }
    return next;
  };
  var clampPromptRequest = (request) => {
    const next = {
      text: request.text.trim().slice(0, GUEST_COMPOSE_TEXT_MAX)
    };
    if (request.send) {
      next.send = true;
    }
    return next;
  };
  var clampBadgeCount = (count) => {
    if (count === null || !Number.isFinite(count))
      return null;
    return Math.min(GUEST_BADGE_MAX, Math.max(0, Math.round(count)));
  };
  var clampFrameHeight = (height) => {
    if (!Number.isFinite(height))
      return 0;
    return Math.min(GUEST_FRAME_HEIGHT_MAX, Math.max(0, Math.ceil(height)));
  };
  var isGuestFilePath = (value) => value.length > 0 && value.length <= GUEST_FILE_PATH_MAX && !value.includes("\x00") && !value.includes("\\");
  var isGuestRequestPath = (value) => {
    if (!value.startsWith("/") || value.includes("\x00") || value.includes("\\") || value.includes("://")) {
      return false;
    }
    if (value.length > GUEST_REQUEST_PATH_MAX) {
      return false;
    }
    const segments = value.split("/");
    return !segments.some((segment) => segment === "." || segment === "..");
  };
  var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
  var isServiceStatusResult = (value) => Boolean(value && "status" in value && serviceStatusSet.has(String(value.status)) && !("body" in value));
  var isGuestRequestResult = (value) => Boolean(value && "status" in value && "body" in value && Number.isInteger(value.status));
  var isFileReadResult = (value) => Boolean(value && "content" in value && String(value.content) === value.content);
  var isFileWriteResult = (value) => Boolean(value && "written" in value && value.written === true);
  var isFileListResult = (value) => Boolean(value && "entries" in value && Array.isArray(value.entries));
  var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
  var isFileStatResult = (value) => Boolean(value && "kind" in value && "size" in value && fileStatKindSet.has(String(value.kind)) && Number.isFinite(value.size));
  var isGenerateResult = (value) => Boolean(value && "text" in value && String(value.text) === value.text && !("status" in value));
  var HOST_PUSH_TYPES = new Set([
    "workspace",
    "shells",
    "ready",
    "directory",
    "session",
    "connection",
    "settings",
    "session-lifecycle",
    "item",
    "resolve",
    "action",
    "service-event",
    "status-control-event",
    "popover-closed",
    "file-open",
    "file-snapshot",
    "file-saved",
    "generate-late",
    "microphone-audio",
    "microphone-ended"
  ]);
  var asWireRecord = (data) => Object(data) === data ? data : null;
  var isNonEmptyString = (value) => String(value) === value && value.length > 0;
  var readResultMessage = (wire) => {
    if (!isNonEmptyString(wire.id))
      return null;
    if (wire.ok === true) {
      const message = {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: true
      };
      if (Object(wire.payload) === wire.payload) {
        message.payload = wire.payload;
      }
      return message;
    }
    if (wire.ok === false && isNonEmptyString(wire.error)) {
      return {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: false,
        error: wire.error,
        code: resolveHostRequestErrorCode(isNonEmptyString(wire.code) ? wire.code : undefined)
      };
    }
    return null;
  };
  var readHostMessage = (data) => {
    const wire = asWireRecord(data);
    if (!wire || wire.channel !== OPENCHAMBER_SDK_CHANNEL || wire.v !== OPENCHAMBER_SDK_API_VERSION)
      return null;
    if (wire.type === "result")
      return readResultMessage(wire);
    if (!HOST_PUSH_TYPES.has(String(wire.type)) || Object(wire.payload) !== wire.payload)
      return null;
    return wire;
  };

  // node_modules/@openchamber/sdk/dist/host.js
  var isKeyEvent = (event) => ("key" in event) && ("metaKey" in event) && ("ctrlKey" in event);
  var isSaveShortcut = (event) => (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s";

  class HostRequestError extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "HostRequestError";
      this.code = code;
    }
  }
  var rejectBadPath = () => Promise.reject(new HostRequestError("BAD_PATH", 'Request path must start with "/" and stay on the declared origin.'));
  var rejectBadFilePath = () => Promise.reject(new HostRequestError("BAD_PATH", `File path must be 1 to ${GUEST_FILE_PATH_MAX} characters without NUL or backslash.`));
  var deviceStorageScope = (options) => {
    if (options === undefined)
      return;
    if (Object(options) !== options || Array.isArray(options) || options.scope !== undefined && options.scope !== "instance" && options.scope !== "device") {
      throw new HostRequestError("HOST_REJECTED", 'Storage scope must be "instance" or "device".');
    }
    return options.scope === "device" ? "device" : undefined;
  };
  var nextId = (n) => {
    n.value += 1;
    return `oc-${n.value}`;
  };
  var connectHost = (options = {}) => {
    const target = options.target ?? ("window" in globalThis ? window : null);
    if (!target) {
      throw new HostRequestError("HOST_UNAVAILABLE", "No window. connectHost runs in a browser frame.");
    }
    const acceptSource = options.acceptSource ?? ((source) => source === target.parent);
    const requestTimeoutMs = options.requestTimeoutMs ?? GUEST_REQUEST_TIMEOUT_MS;
    const readyListeners = new Set;
    const directoryListeners = new Set;
    const sessionListeners = new Set;
    const lifecycleListeners = new Set;
    const connectionListeners = new Set;
    const settingsListeners = new Set;
    const itemListeners = new Set;
    const blockListeners = new Set;
    const serviceEventListeners = new Set;
    const statusControlListeners = new Set;
    const popoverClosedListeners = new Set;
    const lateGenerateListeners = new Set;
    const unclaimedLateGenerate = [];
    let resolveHandler = null;
    let actionHandler = null;
    const fileOpenListeners = new Set;
    const fileSavedListeners = new Set;
    let fileSnapshotHandler = null;
    let lastFile = null;
    let saveShortcutInstalled = false;
    const pending = new Map;
    const workspaceListeners = new Map;
    const shellsListeners = new Map;
    let disposed = false;
    const ids = { value: 0 };
    let lastReady = null;
    let lastLifecycle = null;
    let popoverPointerActive = false;
    let popoverFocusActive = false;
    let popoverActivityReported = null;
    let microphone = null;
    const lifecycleFromSession = (session) => {
      if (!session)
        return null;
      return {
        sessionId: session.id,
        phase: session.busy ? "started" : "completed"
      };
    };
    const post = (message) => {
      target.parent.postMessage(message, "*");
    };
    const listenForLateGenerate = () => {
      if (disposed || target.parent === target || lateGenerateListeners.size === 0 || lastReady?.features?.lateGenerateResults !== true)
        return;
      post({ channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION, type: "generate-late-listen" });
    };
    const emit = (listeners, value) => {
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (error) {
          console.error(error);
        }
      }
    };
    const onMessage = (event) => {
      if (!(event instanceof MessageEvent))
        return;
      if (!acceptSource(event.source))
        return;
      const message = readHostMessage(event.data);
      if (!message)
        return;
      if (message.type === "workspace") {
        const listener = workspaceListeners.get(message.payload.subscriptionId);
        if (listener)
          emit([listener], message.payload.snapshot);
        return;
      }
      if (message.type === "shells") {
        const listener = shellsListeners.get(message.payload.subscriptionId);
        if (listener)
          emit([listener], message.payload.snapshot);
        return;
      }
      if (message.type === "microphone-audio") {
        microphone?.queue.push(message.payload.samples);
        return;
      }
      if (message.type === "microphone-ended") {
        const open = microphone;
        if (!open)
          return;
        microphone = null;
        open.release();
        emit(open.endedListeners, message.payload.reason);
        return;
      }
      if (message.type === "ready") {
        lastReady = message.payload;
        lastLifecycle = lifecycleFromSession(message.payload.session);
        emit(readyListeners, message.payload);
        emit(directoryListeners, message.payload.directory);
        emit(sessionListeners, message.payload.session);
        if (lastLifecycle) {
          emit(lifecycleListeners, lastLifecycle);
        }
        emit(connectionListeners, message.payload.connection);
        emit(settingsListeners, message.payload.settings);
        emit(itemListeners, message.payload.item);
        if (message.payload.block)
          emit(blockListeners, message.payload.block);
        listenForLateGenerate();
        return;
      }
      if (message.type === "service-event") {
        emit(serviceEventListeners, message.payload);
        return;
      }
      if (message.type === "generate-late") {
        if (lateGenerateListeners.size === 0)
          unclaimedLateGenerate.push(message.payload);
        else
          emit(lateGenerateListeners, message.payload);
        return;
      }
      if (message.type === "directory") {
        if (lastReady) {
          lastReady = { ...lastReady, directory: message.payload.directory };
        }
        emit(directoryListeners, message.payload.directory);
        return;
      }
      if (message.type === "session") {
        if (lastReady) {
          lastReady = { ...lastReady, session: message.payload.session };
        }
        if (!message.payload.session) {
          lastLifecycle = null;
        } else if (lastLifecycle?.sessionId !== message.payload.session.id) {
          lastLifecycle = lifecycleFromSession(message.payload.session);
        }
        emit(sessionListeners, message.payload.session);
        return;
      }
      if (message.type === "session-lifecycle") {
        lastLifecycle = message.payload;
        emit(lifecycleListeners, message.payload);
        return;
      }
      if (message.type === "connection") {
        if (lastReady) {
          lastReady = { ...lastReady, connection: message.payload.connection };
        }
        emit(connectionListeners, message.payload.connection);
        return;
      }
      if (message.type === "settings") {
        if (lastReady) {
          lastReady = { ...lastReady, settings: message.payload.settings };
        }
        emit(settingsListeners, message.payload.settings);
        return;
      }
      if (message.type === "item") {
        if (lastReady) {
          lastReady = { ...lastReady, item: message.payload.item };
        }
        emit(itemListeners, message.payload.item);
        return;
      }
      if (message.type === "status-control-event") {
        emit(statusControlListeners, message.payload);
        return;
      }
      if (message.type === "popover-closed") {
        emit(popoverClosedListeners, message.payload);
        return;
      }
      if (message.type === "action") {
        const answer = (payload) => {
          if (!disposed)
            post({
              channel: OPENCHAMBER_SDK_CHANNEL,
              v: OPENCHAMBER_SDK_API_VERSION,
              type: "action-result",
              id: message.id,
              payload
            });
        };
        const handler = actionHandler;
        if (!handler) {
          answer({ ok: false, error: "This extension does not handle background actions." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then(() => answer({ ok: true }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ ok: false, error: (text || "Action failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      if (message.type === "file-open") {
        const next = message.payload;
        if (lastFile && sameFileEditorDocument(lastFile, next))
          return;
        lastFile = next;
        emit(fileOpenListeners, message.payload);
        return;
      }
      if (message.type === "file-saved") {
        emit(fileSavedListeners, message.payload.version);
        return;
      }
      if (message.type === "file-snapshot") {
        const answer = (payload) => {
          if (!disposed)
            post({
              channel: OPENCHAMBER_SDK_CHANNEL,
              v: OPENCHAMBER_SDK_API_VERSION,
              type: "file-snapshot-result",
              id: message.id,
              payload
            });
        };
        const fail = (text) => answer({ error: (text.trim() || "Could not read the edited file.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        const handler = fileSnapshotHandler;
        if (!handler) {
          fail("This extension does not edit files.");
          return;
        }
        Promise.resolve().then(() => handler(message.payload.purpose)).then((snapshot) => {
          if (fileEditorPayloadSize(snapshot) > GUEST_FILE_EDITOR_CONTENT_MAX) {
            fail(`The file is over ${GUEST_FILE_EDITOR_CONTENT_MAX} ${"bytes" in snapshot ? "bytes" : "characters"}.`);
            return;
          }
          if (snapshot.version.length > GUEST_FILE_EDITOR_VERSION_MAX) {
            fail(`The snapshot version is over ${GUEST_FILE_EDITOR_VERSION_MAX} characters.`);
            return;
          }
          answer({ snapshot: "bytes" in snapshot ? { bytes: snapshot.bytes, version: snapshot.version } : { content: snapshot.content, version: snapshot.version } });
        }, (error) => fail(error instanceof Error ? error.message : String(error)));
        return;
      }
      if (message.type === "resolve") {
        const answer = (payload) => {
          post({
            channel: OPENCHAMBER_SDK_CHANNEL,
            v: OPENCHAMBER_SDK_API_VERSION,
            type: "resolve-result",
            id: message.id,
            payload
          });
        };
        const handler = resolveHandler;
        if (!handler) {
          answer({ error: "This extension does not resolve commands." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then((item) => answer({ item: item ? clampAttachRequest(item) : null }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ error: (text || "Command failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter)
        return;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.ok) {
        waiter.resolve(message.payload);
        return;
      }
      waiter.reject(new HostRequestError(message.code, message.error));
    };
    target.addEventListener("message", onMessage);
    post({
      channel: OPENCHAMBER_SDK_CHANNEL,
      v: OPENCHAMBER_SDK_API_VERSION,
      type: "hello"
    });
    const send = (message, timeoutMs = requestTimeoutMs) => {
      if (disposed || target.parent === target) {
        return Promise.reject(new HostRequestError("HOST_UNAVAILABLE", "No host frame. This page is not in an iframe."));
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(message.id);
          reject(new HostRequestError("HOST_TIMEOUT", "Host did not answer in time."));
        }, timeoutMs);
        pending.set(message.id, { resolve, reject, timer });
        post(message);
      });
    };
    const request = (message) => send(message).then(() => {
      return;
    });
    const envelope = { channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION };
    const notify = (message) => {
      if (!disposed && target.parent !== target)
        post(message);
    };
    const requestFileSave = () => notify({ ...envelope, type: "file-save" });
    const postMicrophoneClose = () => {
      if (!disposed && target.parent !== target)
        post({ ...envelope, type: "microphone-close", id: nextId(ids) });
    };
    const openMicrophone = async () => {
      if (microphone)
        throw new HostRequestError("HOST_REJECTED", "The microphone is already open in this frame.");
      if (lastReady?.features?.microphone !== true) {
        throw new HostRequestError("UNSUPPORTED", "This OpenChamber cannot share the microphone with extensions.");
      }
      const AudioContextCtor = globalThis.AudioContext;
      if (typeof AudioContextCtor !== "function")
        throw new HostRequestError("UNSUPPORTED", "This frame has no Web Audio.");
      const context = new AudioContextCtor;
      if (context.sampleRate < GUEST_MICROPHONE_SAMPLE_RATE_MIN || context.sampleRate > GUEST_MICROPHONE_SAMPLE_RATE_MAX) {
        context.close().catch(() => {
          return;
        });
        throw new HostRequestError("UNSUPPORTED", `Audio at ${context.sampleRate} Hz is not supported.`);
      }
      const resumed = context.state === "suspended" ? context.resume().catch(() => {
        return;
      }) : undefined;
      const queue = createSampleQueue(Math.round(context.sampleRate / 4));
      const processor = context.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (event) => queue.pull(event.outputBuffer.getChannelData(0));
      const destination = context.createMediaStreamDestination();
      processor.connect(destination);
      const endedListeners = new Set;
      const open = {
        queue,
        endedListeners,
        release: () => {
          processor.onaudioprocess = null;
          processor.disconnect();
          queue.clear();
          for (const track of destination.stream.getTracks())
            track.stop();
          context.close().catch(() => {
            return;
          });
        }
      };
      microphone = open;
      try {
        const result = await send({ ...envelope, type: "microphone-open", id: nextId(ids), payload: { sampleRate: context.sampleRate } }, GUEST_MICROPHONE_OPEN_TIMEOUT_MS);
        if (!result || !("opened" in result) || result.opened !== true) {
          throw new HostRequestError("HOST_REJECTED", "Host did not open the microphone.");
        }
        await resumed;
        if (microphone !== open)
          throw new HostRequestError("DISCONNECTED", "The microphone closed while it was opening.");
      } catch (error) {
        if (microphone === open)
          microphone = null;
        open.release();
        postMicrophoneClose();
        throw error;
      }
      return {
        stream: destination.stream,
        close: () => {
          if (microphone !== open)
            return;
          microphone = null;
          open.release();
          postMicrophoneClose();
        },
        onEnded: (listener) => {
          endedListeners.add(listener);
          return () => {
            endedListeners.delete(listener);
          };
        }
      };
    };
    const onSaveShortcut = (event) => {
      if (!isKeyEvent(event) || !isSaveShortcut(event))
        return;
      event.preventDefault();
      requestFileSave();
    };
    const onPopoverEscape = (event) => {
      if (!isKeyEvent(event) || event.key !== "Escape" || lastReady?.surface !== "popover" || !lastReady.popover)
        return;
      event.preventDefault();
      closePopover(lastReady.popover.id, "escape").catch(() => {
        return;
      });
    };
    const reportPopoverActivity = () => {
      const popover = lastReady?.surface === "popover" ? lastReady.popover : undefined;
      if (!popover)
        return;
      const active = popoverPointerActive || popoverFocusActive;
      if (popoverActivityReported === active)
        return;
      popoverActivityReported = active;
      setPopoverAnchorActive(popover.id, active).catch(() => {
        return;
      });
    };
    const onPopoverPointerOver = () => {
      if (lastReady?.surface !== "popover" || popoverPointerActive)
        return;
      popoverPointerActive = true;
      reportPopoverActivity();
    };
    const onPopoverPointerOut = (event) => {
      if (lastReady?.surface !== "popover" || event.relatedTarget !== null || !popoverPointerActive)
        return;
      popoverPointerActive = false;
      reportPopoverActivity();
    };
    const onPopoverFocus = () => {
      if (lastReady?.surface !== "popover" || popoverFocusActive)
        return;
      popoverFocusActive = true;
      reportPopoverActivity();
    };
    const onPopoverBlur = () => {
      if (lastReady?.surface !== "popover" || !popoverFocusActive)
        return;
      popoverFocusActive = false;
      reportPopoverActivity();
    };
    const requireIdentity = (value, maximum = 1024) => {
      if (!value.trim() || value.length > maximum)
        throw new HostRequestError("HOST_REJECTED", `Identity must contain 1 to ${maximum} characters.`);
    };
    const readWorkspace = async (query) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const result = await send({ ...envelope, type: "workspace-read", id: nextId(ids), payload: query });
      if (!result || !("kind" in result) || !("state" in result) || result.kind !== query.kind) {
        throw new HostRequestError("HOST_REJECTED", "Host did not return workspace data.");
      }
      return result;
    };
    const subscribeWorkspace = async (query, listener) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const subscriptionId = nextId(ids);
      workspaceListeners.set(subscriptionId, listener);
      try {
        await request({ ...envelope, type: "workspace-subscribe", id: nextId(ids), payload: { subscriptionId, query } });
      } catch (error) {
        workspaceListeners.delete(subscriptionId);
        if (!disposed)
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        throw error;
      }
      return () => {
        if (!workspaceListeners.delete(subscriptionId) || disposed)
          return;
        post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
      };
    };
    const subscribeShells = async (scope, listener) => {
      if (scope.kind === "session")
        requireIdentity(scope.sessionId);
      if (scope.kind === "project")
        requireIdentity(scope.projectId);
      const subscriptionId = nextId(ids);
      shellsListeners.set(subscriptionId, listener);
      try {
        await request({ ...envelope, type: "shells-subscribe", id: nextId(ids), payload: { subscriptionId, scope } });
      } catch (error) {
        shellsListeners.delete(subscriptionId);
        if (!disposed)
          post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        throw error;
      }
      return () => {
        if (!shellsListeners.delete(subscriptionId) || disposed)
          return;
        post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
      };
    };
    const storage = async (payload) => {
      if ("key" in payload && (payload.key.length === 0 || payload.key.length > GUEST_STORAGE_KEY_MAX)) {
        throw new HostRequestError("HOST_REJECTED", "Storage key must contain 1 to 128 characters.");
      }
      if (payload.op === "set" && !isJsonValue(payload.value)) {
        throw new HostRequestError("HOST_REJECTED", "Storage values must be JSON.");
      }
      if (payload.op === "set" && new TextEncoder().encode(JSON.stringify(payload.value)).length > GUEST_STORAGE_VALUE_BYTES) {
        throw new HostRequestError("HOST_REJECTED", "Storage value exceeds 64 KiB.");
      }
      if (payload.scope === "device" && lastReady?.features?.deviceStorage !== true) {
        throw new HostRequestError("UNSUPPORTED", "This host does not support device storage.");
      }
      const result = await send({ ...envelope, type: "storage", id: nextId(ids), payload });
      if (!result || !("storage" in result) || result.op !== payload.op)
        throw new HostRequestError("HOST_REJECTED", "Host did not return storage data.");
      return result;
    };
    const closePopover = (id, reason) => lastReady?.features?.popovers !== true && !(lastReady?.surface === "popover" && lastReady.popover?.id === id) ? Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers.")) : request({ ...envelope, type: "popover-close", id: nextId(ids), payload: reason ? { id, reason } : { id } });
    const setPopoverAnchorActive = (id, active) => lastReady?.features?.popovers !== true && !(lastReady?.surface === "popover" && lastReady.popover?.id === id) ? Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers.")) : request({ ...envelope, type: "popover-anchor", id: nextId(ids), payload: { id, active } });
    target.addEventListener("keydown", onPopoverEscape, true);
    target.addEventListener("pointerover", onPopoverPointerOver);
    target.addEventListener("pointermove", onPopoverPointerOver);
    target.addEventListener("pointerout", onPopoverPointerOut);
    target.addEventListener("focus", onPopoverFocus);
    target.addEventListener("blur", onPopoverBlur);
    return {
      onAction: (handler) => {
        actionHandler = handler;
        return () => {
          if (actionHandler === handler)
            actionHandler = null;
        };
      },
      listProjects: async () => {
        const result = await readWorkspace({ kind: "projects" });
        if (result.kind !== "projects")
          throw new HostRequestError("HOST_REJECTED", "Expected projects.");
        return result;
      },
      listWorktrees: async (projectId) => {
        const result = await readWorkspace({ kind: "worktrees", projectId });
        if (result.kind !== "worktrees")
          throw new HostRequestError("HOST_REJECTED", "Expected worktrees.");
        return result;
      },
      listSessions: async (projectId) => {
        const result = await readWorkspace({ kind: "sessions", projectId });
        if (result.kind !== "sessions")
          throw new HostRequestError("HOST_REJECTED", "Expected sessions.");
        return result;
      },
      onProjects: (listener) => subscribeWorkspace({ kind: "projects" }, (snapshot) => {
        if (snapshot.kind === "projects")
          listener(snapshot);
      }),
      onWorktrees: (projectId, listener) => subscribeWorkspace({ kind: "worktrees", projectId }, (snapshot) => {
        if (snapshot.kind === "worktrees")
          listener(snapshot);
      }),
      onSessions: (projectId, listener) => subscribeWorkspace({ kind: "sessions", projectId }, (snapshot) => {
        if (snapshot.kind === "sessions")
          listener(snapshot);
      }),
      onRunningShells: (scope, listener) => subscribeShells(scope, listener),
      readShellOutput: async (shellId, options) => {
        requireIdentity(shellId, GUEST_SHELL_ID_MAX);
        const cursor = options?.cursor;
        if (cursor !== undefined && (!Number.isInteger(cursor) || cursor < 0)) {
          throw new HostRequestError("HOST_REJECTED", "Shell output cursor must be a non-negative integer.");
        }
        const tailBytes = options?.tailBytes;
        if (tailBytes !== undefined && (!Number.isInteger(tailBytes) || tailBytes < 1 || tailBytes > GUEST_SHELL_OUTPUT_TAIL_MAX)) {
          throw new HostRequestError("HOST_REJECTED", `Shell output tailBytes must be an integer between 1 and ${GUEST_SHELL_OUTPUT_TAIL_MAX}.`);
        }
        const result = await send({ ...envelope, type: "shell-output", id: nextId(ids), payload: { shellId, cursor, tailBytes } });
        const output = result;
        if (!output || typeof output.output !== "string" || !Number.isFinite(output.cursor)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return shell output.");
        }
        return output;
      },
      stopShell: async (shellId) => {
        requireIdentity(shellId, GUEST_SHELL_ID_MAX);
        const result = await send({ ...envelope, type: "shell-stop", id: nextId(ids), payload: { shellId } });
        if (result?.stopped !== true)
          throw new HostRequestError("HOST_REJECTED", "Host did not stop the shell.");
        return { stopped: true };
      },
      openSession: async (sessionId) => {
        requireIdentity(sessionId);
        await request({ ...envelope, type: "open-session", id: nextId(ids), payload: { sessionId } });
      },
      storage: {
        get: async (key, options) => {
          const scope = deviceStorageScope(options);
          const payload = { op: "get", key };
          if (scope)
            payload.scope = scope;
          const result = await storage(payload);
          return result.op === "get" && result.found ? result.value : undefined;
        },
        set: async (key, value, options) => {
          const scope = deviceStorageScope(options);
          const payload = { op: "set", key, value };
          if (scope)
            payload.scope = scope;
          await storage(payload);
        },
        delete: async (key, options) => {
          const scope = deviceStorageScope(options);
          const payload = { op: "delete", key };
          if (scope)
            payload.scope = scope;
          await storage(payload);
        },
        keys: async (options) => {
          const scope = deviceStorageScope(options);
          const payload = { op: "keys" };
          if (scope)
            payload.scope = scope;
          const result = await storage(payload);
          if (result.op !== "keys")
            throw new HostRequestError("HOST_REJECTED", "Expected storage keys.");
          return result.keys;
        }
      },
      onReady: (listener) => {
        readyListeners.add(listener);
        if (lastReady)
          listener(lastReady);
        return () => {
          readyListeners.delete(listener);
        };
      },
      onDirectory: (listener) => {
        directoryListeners.add(listener);
        if (lastReady)
          listener(lastReady.directory);
        return () => {
          directoryListeners.delete(listener);
        };
      },
      onSession: (listener) => {
        sessionListeners.add(listener);
        if (lastReady)
          listener(lastReady.session);
        return () => {
          sessionListeners.delete(listener);
        };
      },
      onSessionLifecycle: (listener) => {
        lifecycleListeners.add(listener);
        if (lastLifecycle)
          listener(lastLifecycle);
        return () => {
          lifecycleListeners.delete(listener);
        };
      },
      onConnection: (listener) => {
        connectionListeners.add(listener);
        if (lastReady)
          listener(lastReady.connection);
        return () => {
          connectionListeners.delete(listener);
        };
      },
      onSettings: (listener) => {
        settingsListeners.add(listener);
        if (lastReady)
          listener(lastReady.settings);
        return () => {
          settingsListeners.delete(listener);
        };
      },
      onItem: (listener) => {
        itemListeners.add(listener);
        if (lastReady)
          listener(lastReady.item);
        return () => {
          itemListeners.delete(listener);
        };
      },
      onBlock: (listener) => {
        blockListeners.add(listener);
        if (lastReady?.block)
          listener(lastReady.block);
        return () => {
          blockListeners.delete(listener);
        };
      },
      onServiceEvent: (listener) => {
        serviceEventListeners.add(listener);
        return () => {
          serviceEventListeners.delete(listener);
        };
      },
      onStatusControl: (listener) => {
        statusControlListeners.add(listener);
        return () => {
          statusControlListeners.delete(listener);
        };
      },
      onPopoverClosed: (listener) => {
        popoverClosedListeners.add(listener);
        return () => {
          popoverClosedListeners.delete(listener);
        };
      },
      setStatusControls: (controls) => {
        if (lastReady?.features?.statusControls !== true) {
          return Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support status controls."));
        }
        if (!isGuestStatusControls(controls)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "Status controls must have unique bounded ids and valid selected options."));
        }
        return request({ ...envelope, type: "status-controls", id: nextId(ids), payload: { controls } });
      },
      openPopover: (payload) => {
        if (lastReady?.features?.popovers !== true) {
          return Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers."));
        }
        if (!isGuestPopoverRequest(payload)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "Popover requests need bounded geometry and JSON data."));
        }
        return request({ ...envelope, type: "popover-open", id: nextId(ids), payload });
      },
      closePopover,
      setPopoverAnchorActive,
      onResolve: (handler) => {
        resolveHandler = handler;
        return () => {
          if (resolveHandler === handler)
            resolveHandler = null;
        };
      },
      toast: (payload) => {
        const message = payload.message.trim();
        if (!message || message.length > GUEST_TOAST_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast message must contain 1 to ${GUEST_TOAST_MAX} characters.`));
        }
        if (payload.copy && payload.copy !== true && (!payload.copy.text.length || payload.copy.text.length > GUEST_CLIPBOARD_TEXT_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast copy text must contain 1 to ${GUEST_CLIPBOARD_TEXT_MAX} characters.`));
        }
        return request({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "toast",
          id: nextId(ids),
          payload: { ...payload, message }
        });
      },
      openUrl: (url) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-url",
        id: nextId(ids),
        payload: { url }
      }),
      ...guestNavigationCalls(request, () => nextId(ids), (message) => Promise.reject(new HostRequestError("HOST_REJECTED", message))),
      answerBlock: (text) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "block-answer",
        id: nextId(ids),
        payload: { text: text.trim().slice(0, GUEST_BLOCK_ANSWER_MAX) }
      }),
      openSurface: (surfaceId) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-surface",
        id: nextId(ids),
        payload: { surfaceId }
      }),
      writeClipboard: (text) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "clipboard-write",
        id: nextId(ids),
        payload: { text }
      }),
      compose: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "compose",
        id: nextId(ids),
        payload
      }),
      attach: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "attach",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      startSession: async (payload) => {
        if (payload.projectId !== undefined)
          requireIdentity(payload.projectId);
        const worktree = payload.worktree;
        if (worktree && worktree !== true) {
          if (worktree.kind === "existing")
            requireIdentity(worktree.directory);
          else {
            if (worktree.name !== undefined)
              requireIdentity(worktree.name, 200);
            if (worktree.baseBranch !== undefined)
              requireIdentity(worktree.baseBranch, 200);
          }
        }
        const result = await send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "start-session",
          id: nextId(ids),
          payload: clampStartSessionRequest(payload)
        }, options.requestTimeoutMs ?? 180000);
        if (!isStartSessionResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a session.");
        }
        return result;
      },
      prompt: (payload) => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "prompt",
        id: nextId(ids),
        payload: clampPromptRequest(payload)
      }).then((result) => {
        if (!isPromptResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a prompt result.");
        }
        return result;
      }),
      sessionLink: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "session-link",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      close: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "close",
        id: nextId(ids)
      }),
      oauthStart: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-start",
        id: nextId(ids)
      }),
      oauthDisconnect: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-disconnect",
        id: nextId(ids)
      }),
      request: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host request result was empty.");
        }
        return result;
      }),
      serviceRequest: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host service request result was empty.");
        }
        return result;
      }),
      serviceStatus: () => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-status",
        id: nextId(ids)
      }).then((result) => {
        if (!isServiceStatusResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return service status.");
        }
        return result;
      }),
      readFile: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-read",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileReadResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file content.");
        }
        return result;
      }),
      writeFile: (path, content) => {
        if (!isGuestFilePath(path)) {
          return rejectBadFilePath();
        }
        if (content.length > GUEST_FILE_CONTENT_MAX) {
          return Promise.reject(new HostRequestError("FILE_TOO_LARGE", `Content is over ${GUEST_FILE_CONTENT_MAX} characters.`));
        }
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "file-write",
          id: nextId(ids),
          payload: { path, content }
        }).then((result) => {
          if (!isFileWriteResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not confirm the write.");
          }
          return result;
        });
      },
      listDir: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-list",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileListResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return directory entries.");
        }
        return result;
      }),
      stat: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-stat",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileStatResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file status.");
        }
        return result;
      }),
      generate: (input) => {
        const prompt = input.prompt.trim();
        const system = input.system?.trim();
        if (prompt.length === 0 || prompt.length > GUEST_GENERATE_PROMPT_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Prompt must be 1 to ${GUEST_GENERATE_PROMPT_MAX} characters.`));
        }
        if (system !== undefined && (system.length === 0 || system.length > GUEST_GENERATE_SYSTEM_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `System prompt must be 1 to ${GUEST_GENERATE_SYSTEM_MAX} characters.`));
        }
        const maxOutputTokens = input.maxOutputTokens === undefined ? undefined : Math.min(GUEST_GENERATE_OUTPUT_TOKENS_MAX, Math.max(1, Math.floor(input.maxOutputTokens)));
        if (maxOutputTokens !== undefined && !Number.isFinite(maxOutputTokens)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "maxOutputTokens must be a number."));
        }
        const payload = { prompt };
        if (system !== undefined)
          payload.system = system;
        if (maxOutputTokens !== undefined)
          payload.maxOutputTokens = maxOutputTokens;
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "generate",
          id: nextId(ids),
          payload
        }, options.requestTimeoutMs ?? GUEST_GENERATE_TIMEOUT_MS).then((result) => {
          if (!isGenerateResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not return generated text.");
          }
          return result;
        });
      },
      onLateGenerateResult: (listener) => {
        lateGenerateListeners.add(listener);
        for (const result of unclaimedLateGenerate.splice(0))
          emit([listener], result);
        listenForLateGenerate();
        return () => {
          lateGenerateListeners.delete(listener);
        };
      },
      openMicrophone,
      setBadge: (count) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "badge",
        id: nextId(ids),
        payload: { count: clampBadgeCount(count) }
      }),
      setHeight: (height) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "resize",
        id: nextId(ids),
        payload: { height: clampFrameHeight(height) }
      }),
      onFileOpen: (listener) => {
        fileOpenListeners.add(listener);
        if (!saveShortcutInstalled) {
          saveShortcutInstalled = true;
          target.addEventListener("keydown", onSaveShortcut, true);
        }
        if (lastFile)
          listener(lastFile);
        return () => {
          fileOpenListeners.delete(listener);
        };
      },
      onFileSnapshot: (handler) => {
        fileSnapshotHandler = handler;
        return () => {
          if (fileSnapshotHandler === handler)
            fileSnapshotHandler = null;
        };
      },
      onFileSaved: (listener) => {
        fileSavedListeners.add(listener);
        return () => {
          fileSavedListeners.delete(listener);
        };
      },
      reportFileChange: (change) => notify({ ...envelope, type: "file-change", payload: { dirty: change.dirty, edited: change.edited } }),
      requestFileSave,
      reportFileUnsupported: () => notify({ ...envelope, type: "file-unsupported" }),
      dispose: () => {
        for (const subscriptionId of workspaceListeners.keys()) {
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        }
        workspaceListeners.clear();
        for (const subscriptionId of shellsListeners.keys()) {
          post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        }
        shellsListeners.clear();
        if (microphone) {
          postMicrophoneClose();
          microphone.release();
          microphone = null;
        }
        disposed = true;
        resolveHandler = null;
        actionHandler = null;
        fileSnapshotHandler = null;
        fileOpenListeners.clear();
        fileSavedListeners.clear();
        if (saveShortcutInstalled)
          target.removeEventListener("keydown", onSaveShortcut, true);
        target.removeEventListener("message", onMessage);
        target.removeEventListener("keydown", onPopoverEscape, true);
        target.removeEventListener("pointerover", onPopoverPointerOver);
        target.removeEventListener("pointermove", onPopoverPointerOver);
        target.removeEventListener("pointerout", onPopoverPointerOut);
        target.removeEventListener("focus", onPopoverFocus);
        target.removeEventListener("blur", onPopoverBlur);
        for (const waiter of pending.values()) {
          clearTimeout(waiter.timer);
          waiter.reject(new HostRequestError("HOST_UNAVAILABLE", "Host client was disposed."));
        }
        pending.clear();
        readyListeners.clear();
        directoryListeners.clear();
        sessionListeners.clear();
        lifecycleListeners.clear();
        connectionListeners.clear();
        settingsListeners.clear();
        itemListeners.clear();
        blockListeners.clear();
        serviceEventListeners.clear();
        statusControlListeners.clear();
        popoverClosedListeners.clear();
        lateGenerateListeners.clear();
        unclaimedLateGenerate.length = 0;
      }
    };
  };
  // node_modules/@openchamber/sdk/dist/service-providers.js
  var BROWSER_CONTROL_ACTIONS = [
    "browser.open",
    "browser.snapshot",
    "browser.click",
    "browser.type",
    "browser.select",
    "browser.scroll",
    "browser.back",
    "browser.forward",
    "browser.inspect",
    "browser.capture",
    "browser.resize",
    "browser.close"
  ];
  var BROWSER_PROVIDER_IDLE_MS = 10 * 60000;
  var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
  var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 60000;
  var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 60000;
  var TRACKER_PROVIDER_IDLE_MS = 10 * 60000;
  var QUOTA_PROVIDER_IDLE_MS = 10 * 60000;
  // node_modules/@openchamber/sdk/dist/service-surface.js
  var SURFACE_CONTROLLERS = ["none", "agent", "user"];
  var CONTROLLERS = new Set(SURFACE_CONTROLLERS);
  // src/panel.js
  var host = connectHost();
  var root = document.getElementById("app");
  var lastFeedCount = 0;
  var directory = null;
  var session = null;
  var swarms = [];
  var selected = "";
  var tab = "Overview";
  var mode = "Hive";
  var filter = "";
  var memberFilter = "";
  var replay = null;
  var playing = false;
  var timer = null;
  var error = "";
  var loading = false;
  var ready = false;
  var graphMember = "";
  var follow = true;
  var memberSearch = "";
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var fmt = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  var palette = ["#f9be51", "#72d4f6", "#bd9afa", "#5cddb0", "#f28da7", "#fa9d63", "#9da9ff", "#a5e078", "#f5cf81", "#69c8df", "#d5a9df", "#b0b9c9"];
  var roleColor = (m, i = 0) => m.role === "coordinator" ? "#f9be51" : m.role === "verifier" ? "#5cddb0" : m.role === "monitor" ? "#bd9afa" : palette[(i + 1) % palette.length];
  var glyphs = { Overview: "◉", Board: "▤", Members: "♟", Graph: "⬡", coordinator: "♛", monitor: "◈", verifier: "✓", worker: "✦", brief: "▣", done: "✓", verified: "✓", changes: "↺", question: "?", blocker: "!", report: "▤", stall: "◈", instruction: "➜", message: "↗" };
  var status = (s) => '<span class="pill ' + esc(s) + '"><i class="dot"></i>' + esc({ waiting: "Standing by", dispatching: "Waking", active: "Working", retired: "Retired", running: "Live", done: "Complete", blocked: "Needs attention", stopped: "Stopped", paused: "Paused", failed: "Failed" }[s] || s) + "</span>";
  function bee(m, i = 0, large = false) {
    const c = roleColor(m, i), sleep = m.state === "waiting", retired = m.state === "retired";
    return '<svg class="bee-icon ' + (sleep ? "dozing" : retired ? "retired-bee" : "buzz") + '" viewBox="0 0 40 40" width="' + (large ? 52 : 34) + '" height="' + (large ? 52 : 34) + '" aria-hidden="true" shape-rendering="crispEdges"><g stroke="none"><path fill="#c6ecff" d="M5 5h12v3h3v12H9v-4H5zM23 5h12v11h-4v4H20V8h3z"/><path fill="#78aecf" d="M8 8h8v3H8zM25 8h8v3h-8z"/><path fill="#302233" d="M12 14h16v3h4v4h4v9h-4v5H8v-5H4v-9h4v-4h4z"/><path fill="' + c + '" d="M12 17h16v3h4v10h-4v2H12v-2H8V20h4z"/><path fill="#402a35" d="M12 17h5v15h-5zM23 17h5v15h-5z"/><path fill="#fff5d5" d="M29 20h3v4h-3z"/><path fill="#382836" d="M29 23h3v3h-3zM36 24h4v3h-4z"/>' + (m.role === "coordinator" ? '<path fill="#ffe38a" d="M10 2h3v4h5V1h4v5h5V2h3v9H10z"/>' : m.role === "verifier" ? '<path fill="#60e4ad" d="M28 1h11v10h-3v4h-5v-4h-3z"/><path fill="#173c39" d="M30 6h2v2h2V4h3v5h-3v2h-2V9h-2z"/>' : m.role === "monitor" ? '<path fill="#c0a7ff" d="M32 1h4v3h4v4h-4v3h-4V8h-4V4h4z"/>' : "") + "</g>" + (sleep ? '<text x="29" y="12" fill="#94b4df" font-size="9" font-weight="bold">z</text>' : "") + "</svg>";
  }
  var avatar = (m, i = 0) => '<span class="avatar" style="--role:' + roleColor(m, i) + '">' + bee(m, i) + "</span>";
  var icon = (name) => '<span class="glyph">' + (glyphs[name] || "·") + "</span>";
  async function api(path, body, query) {
    const r = await host.serviceRequest({ method: body ? "POST" : "GET", path, ...body ? { body: JSON.stringify(body) } : {}, ...query ? { query } : {} });
    const v = JSON.parse(r.body);
    if (r.status >= 400)
      throw Error(v.error || "Request failed");
    return v;
  }
  function current() {
    return swarms.find((s) => s.id === selected) || swarms[0];
  }
  async function refresh() {
    if (!ready || loading || !directory && !session)
      return;
    loading = true;
    try {
      const next = await api("/list", null, { directory: directory || "", sessionId: session?.id || "" });
      if (JSON.stringify(next) === JSON.stringify(swarms) && !error)
        return;
      swarms = next;
      if (!swarms.some((s) => s.id === selected))
        selected = swarms[0]?.id || "";
      error = "";
      render();
    } catch (e) {
      error = e.message;
      render();
    } finally {
      loading = false;
    }
  }
  async function action(path, body) {
    try {
      error = "";
      const result = await api(path, body);
      await refresh();
      return result;
    } catch (e) {
      error = e.message;
      render();
      return null;
    }
  }
  function overview(s) {
    const workers = s.members.filter((m) => m.role !== "coordinator" && m.role !== "verifier"), done = workers.filter((m) => ["reported", "verified"].includes(m.taskState)).length, active = s.members.filter((m) => ["active", "dispatching"].includes(m.state)), blocked = s.members.filter((m) => m.state === "blocked"), pct = workers.length ? Math.round(done / workers.length * 100) : 0;
    const tasks = s.members.filter((m) => m.role !== "coordinator");
    return '<section class="goal"><div class="eyebrow">✦ SWARM GOAL</div><h1>' + esc(s.title) + "</h1><p>" + esc(s.task) + '</p><div class="row"><span class="chip gold">⬡ ' + esc(s.key) + '</span><span class="chip blue">▤ ' + s.posts.length + " posts</span>" + status(s.status) + '</div></section><div class="stats"><div class="card progress-stat"><div class="ring" style="--progress:' + pct + '%"><strong>' + done + "/" + workers.length + "</strong></div><div><strong>Tasks done</strong><small>" + pct + '% reported</small></div></div><div class="card stat"><small>✦ Running</small><strong class="green-text">' + active.length + '</strong></div><div class="card stat"><small>☾ Standby</small><strong class="blue-text">' + s.members.filter((m) => m.state === "waiting").length + '</strong></div><div class="card stat"><small>! Attention</small><strong class="orange-text">' + blocked.length + '</strong></div></div><div class="split"><section class="stack"><h2 class="section-title">✦ Running &amp; assigned tasks <span>' + tasks.length + "</span></h2>" + (tasks.length ? tasks.map((m, i) => '<article class="task-card card" style="--role:' + roleColor(m, i) + '"><div class="member-head"><div class="row">' + avatar(m, i) + "<div><strong>@" + esc(m.name) + '</strong><small class="block">' + esc(m.role) + " · " + esc(m.taskState) + "</small></div></div>" + status(m.state) + '</div><p class="brief">' + esc(m.brief) + "</p>" + (m.paths.length ? '<div class="row">' + m.paths.map((p) => '<code class="chip">' + esc(p) + "</code>").join("") + "</div>" : "") + '<div class="progress"><i style="width:' + (["reported", "verified"].includes(m.taskState) ? 100 : m.state === "active" ? 50 : 0) + '%"></i></div>' + (m.sessionId ? '<button class="link-button" data-open="' + esc(m.sessionId) + '">↗ Open conversation</button>' : "") + "</article>").join("") : '<div class="card muted">The coordinator is preparing the team.</div>') + '</section><section class="stack"><h2 class="section-title">⬡ The team</h2><div class="card roster">' + [...s.members, { name: "monitor", role: "monitor", state: s.status === "running" ? "waiting" : "retired" }].map((m, i) => '<button class="roster-row" ' + (m.sessionId ? 'data-open="' + esc(m.sessionId) + '"' : "disabled") + ">" + avatar(m, i) + '<span class="fill"><strong>@' + esc(m.name) + '</strong><small class="block">' + esc(m.role) + "</small></span>" + status(m.state) + "</button>").join("") + '</div><div class="card monitor-card"><h2>◈ Monitor</h2><p class="muted">Keeps watch while bees sleep. Wakes members on new mentions and detects stalled work.</p><div class="row"><span class="chip purple">' + s.members.reduce((n, m) => n + m.pending, 0) + ' queued</span><span class="chip green">Token-free watch</span></div></div><div class="card"><h2>↗ Latest activity</h2>' + s.posts.slice(-4).reverse().map((p) => '<div class="post compact"><strong class="mention">@' + esc(p.from) + "</strong> <small>" + fmt(p.at) + "</small><p>" + esc(p.text.slice(0, 150)) + "</p></div>").join("") + "</div>" + (s.summary ? '<div class="card"><h2>✓ Result</h2><p>' + esc(s.summary) + "</p></div>" : "") + "</section></div>";
  }
  function board(s) {
    const self = s.members.find((m) => m.sessionId === session?.id);
    let newDivider = false;
    let posts = s.posts.filter((p) => (!filter || JSON.stringify(p).toLowerCase().includes(filter.toLowerCase())) && (!memberFilter || p.from === memberFilter || p.to.includes(memberFilter)));
    return '<div class="toolbar"><input class="fill" type="search" id="filter" value="' + esc(filter) + '" placeholder="Search board"><select id="memberFilter"><option value="">All members</option>' + s.members.map((m) => '<option value="' + esc(m.name) + '" ' + (m.name === memberFilter ? "selected" : "") + ">@" + esc(m.name) + "</option>").join("") + '</select><button id="follow" aria-pressed="' + follow + '">Follow ' + (follow ? "on" : "off") + '</button></div><div class="card" id="feed">' + (posts.length ? posts.map((p) => {
      const divider = !newDivider && self && p.id > self.read ? (newDivider = true, '<div class="new-divider">New</div>') : "";
      const author = s.members.find((m) => m.name === p.from) || { name: p.from, role: p.from === "monitor" ? "monitor" : "worker", state: "waiting" };
      const color = roleColor(author, s.members.indexOf(author));
      return divider + '<article class="post board-post" style="--role:' + color + '"><div class="row">' + avatar(author, Math.max(0, s.members.indexOf(author))) + '<strong class="sender">@' + esc(p.from) + '</strong><span class="muted">→</span><span class="mention">' + esc(p.to.map((x) => "@" + x).join(", ")) + '</span><span class="kind-chip ' + esc(p.kind) + '">' + icon(p.kind) + " " + esc(p.kind) + "</span><small>#" + p.id + " · " + fmt(p.at) + '</small></div><div class="text">' + esc(p.text) + "</div></article>";
    }).join("") : '<p class="muted">No matching posts.</p>') + "</div>" + (s.status === "running" ? '<form id="message" class="card" style="margin-top:12px"><h2>Post to board</h2><div class="row"><label>To</label><select name="to"><option value="coordinator">@coordinator</option><option value="all">@all</option>' + s.members.filter((m) => m.name !== "coordinator" && m.state !== "retired").map((m) => "<option>" + esc(m.name) + "</option>").join("") + '</select></div><textarea name="text" placeholder="Send a message and wake the recipient" required maxlength="20000"></textarea><button class="primary">Post message</button></form>' : "");
  }
  function members(s) {
    const groups = [["Coordinator", s.members.filter((m) => m.role === "coordinator")], ["Active", s.members.filter((m) => m.role !== "coordinator" && ["active", "dispatching", "blocked"].includes(m.state))], ["Standing by", s.members.filter((m) => m.role !== "coordinator" && m.state === "waiting")], ["Retired", s.members.filter((m) => m.role !== "coordinator" && m.state === "retired")]];
    const card = (m) => '<div class="card task-card" style="--role:' + roleColor(m, s.members.indexOf(m)) + '"><div class="member-head"><div class="row">' + avatar(m, s.members.indexOf(m)) + "<strong>@" + esc(m.name) + "</strong></div>" + status(m.state) + "</div><small>" + esc(m.role) + " · " + esc(m.model || "Default model") + " · " + m.pending + " pending · latest post #" + m.lastPost + "</small><p>" + esc(m.brief) + "</p>" + (m.paths.length ? '<p class="muted">Ownership: ' + esc(m.paths.join(", ")) + "</p>" : "") + (m.lastReply ? '<p class="muted">' + esc(m.lastReply.slice(0, 180)) + "</p>" : "") + (m.error ? '<p class="error">' + esc(m.error) + "</p>" : "") + '<div class="row">' + (m.sessionId ? '<button data-open="' + esc(m.sessionId) + '">Open conversation</button>' : "") + (m.state === "blocked" && s.status === "running" ? '<button data-retry="' + esc(m.name) + '">Retry / wake</button>' : "") + "</div></div>";
    return '<input type="search" id="memberSearch" placeholder="Search members" value="' + esc(memberSearch) + '" style="margin-bottom:12px"><div class="card" style="margin-bottom:14px"><div class="member-head"><div class="row">' + avatar({ role: "monitor", state: "waiting" }) + "<strong>@monitor</strong></div>" + status(s.status === "running" ? "waiting" : "retired") + "</div><small>Runtime supervisor · token-free · checks queued work and stalls</small></div>" + groups.map(([name, items]) => {
      items = items.filter((m) => !memberSearch || m.name.includes(memberSearch.toLowerCase()) || m.role.includes(memberSearch.toLowerCase()));
      if (!items.length)
        return "";
      const body = items.map(card).join("");
      return name === "Retired" ? "<details><summary>Retired (" + items.length + ')</summary><div class="stack">' + body + "</div></details>" : '<section class="stack" style="margin-bottom:18px"><h2>' + name + " (" + items.length + ")</h2>" + body + "</section>";
    }).join("");
  }
  function graph(s) {
    const count = replay === null ? s.posts.length : Math.min(replay, s.posts.length), posts = s.posts.slice(0, count), last = posts.at(-1);
    const nodes = [...s.members, { name: "monitor", role: "monitor", state: s.status === "running" ? "waiting" : "retired" }], pos = new Map;
    const radius = nodes.length > 8 ? 205 : 165, cx = 350, cy = 240;
    nodes.forEach((m, i) => {
      const a = (i - 1) * Math.PI * 2 / Math.max(1, nodes.length - 1) - Math.PI / 2;
      pos.set(m.name, i === 0 ? [cx, cy] : [cx + radius * Math.cos(a), cy + radius * 0.88 * Math.sin(a)]);
    });
    const edges = new Map;
    for (const p of posts) {
      if (!pos.has(p.from))
        continue;
      for (const to of p.to)
        if (pos.has(to) && to !== p.from) {
          let k = p.from + "|" + to;
          edges.set(k, (edges.get(k) || 0) + 1);
        }
    }
    const hex = (r) => Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 - 30) * Math.PI / 180;
      return [Math.cos(a) * r, Math.sin(a) * r].join(",");
    }).join(" ");
    const latest = last ? new Set(last.to.map((t) => last.from + "|" + t)) : new Set;
    let drawing = '<defs><pattern id="honey" width="54" height="94" patternUnits="userSpaceOnUse"><path d="M27 0 54 15.5V46.5L27 62 0 46.5V15.5ZM0 62 27 77.5V94M54 62 27 77.5" fill="none" stroke="#7187a0" stroke-opacity=".12"/></pattern><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0 7 3 0 6" fill="#7dd3fc"/></marker><marker id="hot" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0 7 3 0 6" fill="#59e7ff"/></marker></defs><rect width="700" height="480" rx="14" fill="url(#honey)"/>';
    for (const [k, n] of edges) {
      const [a, b] = k.split("|"), [x, y] = pos.get(a), [u, v] = pos.get(b), d = Math.hypot(u - x, v - y) || 1, hot = latest.has(k), r = mode === "Hive" ? 47 : 29, dx = (u - x) / d, dy = (v - y) / d, ex = x + dx * r, ey = y + dy * r, tx = u - dx * (r + 3), ty = v - dy * (r + 3), qx = (x + u) / 2 - (v - y) * 0.15, qy = (y + v) / 2 + (u - x) * 0.15;
      if (mode === "Hive" && !hot && n < 2)
        continue;
      drawing += '<path class="graph-edge ' + (hot ? "beam" : "") + '" d="M' + ex + " " + ey + " Q" + qx + " " + qy + " " + tx + " " + ty + '" fill="none" stroke="' + (hot ? "#59e7ff" : "#7398cf") + '" stroke-width="' + (hot ? 3.5 : Math.min(5, 1 + n * 0.55)) + '" stroke-opacity="' + (hot ? 1 : 0.55) + '" marker-end="url(#' + (hot ? "hot" : "arr") + ')"/>';
      if (mode === "Mentions")
        drawing += '<g><rect x="' + (qx - 11) + '" y="' + (qy - 9) + '" width="22" height="18" rx="8" fill="#24354c" stroke="#527da3"/><text x="' + qx + '" y="' + (qy + 4) + '" text-anchor="middle" fill="#e0f2ff" font-size="11" font-weight="700">' + n + "</text></g>";
    }
    nodes.forEach((m, i) => {
      const [x, y] = pos.get(m.name), c = roleColor(m, i), finished = ["reported", "verified"].includes(m.taskState) || m.state === "retired", active = ["active", "dispatching"].includes(m.state), selected = graphMember === m.name, label = m.name.length > 19 ? m.name.slice(0, 17) + "…" : m.name;
      drawing += '<g class="node ' + (m.state === "retired" ? "retired-node" : "") + '" role="button" tabindex="0" aria-label="Inspect ' + esc(m.name) + '" data-node="' + esc(m.name) + '" transform="translate(' + x + " " + y + ')"><title>@' + esc(m.name) + " · " + esc(m.state) + "</title>";
      if (mode === "Hive") {
        const r = nodes.length > 8 ? 39 : 49;
        drawing += '<polygon points="' + hex(r + 5) + '" fill="' + c + '" fill-opacity=".08" stroke="' + c + '" stroke-opacity=".22"/><polygon points="' + hex(r) + '" fill="' + c + '" fill-opacity=".11" stroke="' + (finished ? "#5cddb0" : c) + '" stroke-width="' + (selected ? 4 : active ? 2.8 : 1.6) + '"/><g transform="translate(-24 -27)">' + bee(m, i, true) + "</g>";
        if (finished)
          drawing += '<circle cx="31" cy="-30" r="10" fill="#126248" stroke="#5cddb0"/><text x="31" y="-26" font-size="12" fill="#bafde1" text-anchor="middle">✓</text>';
        if (active)
          drawing += '<circle class="ping" cx="31" cy="-30" r="5" fill="#5cddb0"/>';
      } else
        drawing += '<circle r="28" fill="' + c + '" fill-opacity=".17" stroke="' + c + '" stroke-width="' + (selected ? 4 : 2) + '"/><g transform="translate(-18 -18)">' + bee(m, i) + "</g>";
      const ly = mode === "Hive" ? nodes.length > 8 ? 54 : 63 : 42;
      drawing += '<rect x="' + -Math.max(35, label.length * 3.4) + '" y="' + (ly - 12) + '" width="' + Math.max(70, label.length * 6.8) + '" height="19" rx="8" fill="#111a29" stroke="' + c + '" stroke-opacity=".4"/><text y="' + (ly + 1) + '" text-anchor="middle" fill="' + c + '" font-size="11.5" font-weight="650">@' + esc(label) + "</text></g>";
    });
    const detail = nodes.find((m) => m.name === graphMember), done = s.members.filter((m) => m.role === "worker" && m.taskState === "reported").length, total = s.members.filter((m) => m.role === "worker").length;
    return '<div class="graph-shell"><div class="toolbar graph-tools"><div class="segmented"><button data-mode="Hive" class="' + (mode === "Hive" ? "selected" : "") + '">⬡ Hive</button><button data-mode="Mentions" class="' + (mode === "Mentions" ? "selected" : "") + '">↗ Mentions</button></div><span class="chip green">✓ ' + done + " of " + total + ' reported</span></div><div class="timeline"><button id="prev" aria-label="Previous post">⏮</button><button id="play" aria-label="Play or pause">' + (playing ? "Ⅱ" : "▶") + '</button><button id="next" aria-label="Next post">⏭</button><input id="replay" type="range" min="0" max="' + s.posts.length + '" value="' + count + '" aria-label="Replay timeline"><span class="counter">' + count + " / " + s.posts.length + '</span><button id="live" class="' + (replay === null ? "live-button" : "") + '">● Live</button></div><svg class="graph" viewBox="0 0 700 480" aria-label="Swarm communication graph">' + drawing + '</svg><div class="row legend"><span><i style="background:#5cddb0"></i> Working / done</span><span><i style="background:#f9be51"></i> Coordinator</span><span><i style="background:#bd9afa"></i> Monitor</span><span><i style="background:#59e7ff"></i> Latest mention</span><span>☾ Sleeping</span></div><div class="graph-footer"><small>' + edges.size + ' connections · node status is live, message history follows replay</small><button id="zoom">⛶ Expand</button></div></div>' + (last ? '<div class="card replay-post"><div class="eyebrow">▤ POST #' + last.id + " · " + fmt(last.at) + '</div><div class="row"><strong class="mention">@' + esc(last.from) + '</strong><span>→</span><span class="blue-text">' + esc(last.to.map((x) => "@" + x).join(", ")) + '</span><span class="kind-chip ' + esc(last.kind) + '">' + icon(last.kind) + " " + esc(last.kind) + '</span></div><p class="brief">' + esc(last.text) + "</p></div>" : "") + (detail ? '<div class="card"><div class="row">' + avatar(detail, nodes.indexOf(detail)) + "<strong>@" + esc(detail.name) + "</strong> " + status(detail.state) + "</div><p>" + esc(detail.brief || "Supervises swarm activity") + "</p>" + (detail.sessionId ? '<button data-open="' + esc(detail.sessionId) + '">↗ Open conversation</button>' : "") + "</div>" : "");
  }
  function render() {
    const startForm = root.querySelector("#start"), startVisible = startForm && !startForm.hidden, startDraft = startForm?.querySelector("textarea")?.value || "", previous = root.querySelector("#message textarea"), draft = previous?.value || "", to = root.querySelector("#message select")?.value, active = document.activeElement?.id, field = document.activeElement?.name, formId = document.activeElement?.form?.id, selection = document.activeElement?.selectionStart ?? null;
    const s = current();
    root.innerHTML = '<header><div class="brand"><span class="logo">' + bee({ role: "coordinator", state: "active" }, 0) + '</span><div><strong>Swarm</strong><small class="block">Collaborative agents</small></div></div><div class="row">' + (s ? status(s.status) : "") + '<button id="refresh">Refresh</button></div></header>' + (error ? '<div class="notice error">' + esc(error) + "</div>" : "") + "<main>" + (!s ? '<h1>Start a swarm</h1><p class="muted">Use the current conversation or start a new one. Each bee gets its own OpenCode session.</p>' : '<div class="toolbar"><select id="swarmSelect">' + swarms.map((x) => '<option value="' + esc(x.id) + '" ' + (x.id === s.id ? "selected" : "") + ">" + esc(x.key + " · " + x.title) + "</option>").join("") + '</select><div class="row">' + (s.status === "running" ? '<button class="danger" id="stop">Stop swarm</button>' : "") + '<button id="new">New swarm</button></div></div><nav class="tabs">' + ["Overview", "Board", "Members", "Graph"].map((t) => '<button data-tab="' + t + '" class="' + (tab === t ? "selected" : "") + '">' + icon(t) + " " + t + "</button>").join("") + '</nav><div style="height:14px"></div>' + { Overview: overview, Board: board, Members: members, Graph: graph }[tab](s)) + '<form id="start" class="card" ' + (s ? "hidden" : "") + '><h2>New swarm</h2><p class="muted">' + esc(directory || "Open a project") + " · " + esc(session?.title || "New coordinator conversation") + '</p><textarea name="task" required maxlength="12000" placeholder="Describe the task and acceptance criteria"></textarea><button class="primary" ' + (!directory || session?.busy ? "disabled" : "") + ">Launch swarm</button>" + (session?.busy ? "<small> Wait for current turn to finish.</small>" : "") + "</form></main>";
    if (tab === "Board" && s && s.posts.length > lastFeedCount && follow) {
      lastFeedCount = s.posts.length;
      root.querySelector("#feed")?.lastElementChild?.scrollIntoView({ block: "nearest" });
    }
    if (startVisible && root.querySelector("#start")) {
      root.querySelector("#start").hidden = false;
      root.querySelector("#start textarea").value = startDraft;
    }
    if (previous && root.querySelector("#message textarea")) {
      root.querySelector("#message textarea").value = draft;
      if (to)
        root.querySelector("#message select").value = to;
    }
    const focus = active ? document.getElementById(active) : formId && field ? document.getElementById(formId)?.elements.namedItem(field) : null;
    if (focus) {
      focus.focus({ preventScroll: true });
      if (selection !== null && focus.setSelectionRange)
        focus.setSelectionRange(selection, selection);
    }
    root.querySelector("#refresh").onclick = refresh;
    root.querySelector("#start").onsubmit = async (e) => {
      e.preventDefault();
      const task = new FormData(e.target).get("task");
      const result = await action("/start", { task, directory, sessionId: session?.id || null, model: session?.model });
      if (result) {
        selected = result.id;
        root.querySelector("#start").reset();
        root.querySelector("#start").hidden = true;
        render();
      }
    };
    root.querySelector("#new")?.addEventListener("click", () => {
      root.querySelector("#start").hidden = false;
      root.querySelector("#start textarea").focus();
    });
    root.querySelector("#swarmSelect")?.addEventListener("change", (e) => {
      selected = e.target.value;
      replay = null;
      render();
    });
    root.querySelector("#stop")?.addEventListener("click", () => {
      if (confirm("Stop every member in this swarm?"))
        action("/stop", { id: s.id });
    });
    root.querySelectorAll("[data-tab]").forEach((el) => el.onclick = () => {
      tab = el.dataset.tab;
      render();
    });
    root.querySelectorAll("[data-mode]").forEach((el) => el.onclick = () => {
      mode = el.dataset.mode;
      render();
    });
    root.querySelectorAll("[data-node]").forEach((el) => {
      el.onclick = () => {
        graphMember = el.dataset.node;
        render();
      };
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          el.click();
        }
      };
    });
    root.querySelector("#zoom")?.addEventListener("click", () => {
      const el = root.querySelector(".graph-shell");
      el.classList.toggle("expanded");
    });
    root.querySelectorAll("[data-open]").forEach((el) => el.onclick = () => host.openSession(el.dataset.open).catch((e) => {
      error = e.message;
      render();
    }));
    root.querySelectorAll("[data-retry]").forEach((el) => el.onclick = () => action("/retry", { id: s.id, name: el.dataset.retry }));
    root.querySelector("#follow")?.addEventListener("click", () => {
      follow = !follow;
      render();
    });
    root.querySelector("#memberSearch")?.addEventListener("input", (e) => {
      memberSearch = e.target.value;
      render();
      root.querySelector("#memberSearch")?.focus();
    });
    root.querySelector("#filter")?.addEventListener("input", (e) => {
      filter = e.target.value;
      render();
    });
    root.querySelector("#memberFilter")?.addEventListener("change", (e) => {
      memberFilter = e.target.value;
      render();
    });
    root.querySelector("#message")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const body = { id: s.id, to: f.get("to"), text: f.get("text") };
      e.target.reset();
      await action("/message", body);
    });
    root.querySelector("#prev")?.addEventListener("click", () => {
      replay = Math.max(0, (replay ?? s.posts.length) - 1);
      render();
    });
    root.querySelector("#next")?.addEventListener("click", () => {
      replay = Math.min(s.posts.length, (replay ?? s.posts.length) + 1);
      render();
    });
    root.querySelector("#replay")?.addEventListener("input", (e) => {
      replay = Number(e.target.value);
      render();
    });
    root.querySelector("#live")?.addEventListener("click", () => {
      clearInterval(timer);
      playing = false;
      replay = null;
      render();
    });
    root.querySelector("#play")?.addEventListener("click", () => {
      if (playing) {
        clearInterval(timer);
        playing = false;
        render();
        return;
      }
      playing = true;
      if (replay === null || replay >= s.posts.length)
        replay = 0;
      timer = setInterval(() => {
        if (replay >= current().posts.length) {
          clearInterval(timer);
          playing = false;
        } else
          replay++;
        render();
      }, 500);
      render();
    });
  }
  host.onReady((ctx) => {
    ready = true;
    directory = ctx.directory;
    session = ctx.session;
    document.documentElement.dataset.theme = ctx.theme.mode;
    document.documentElement.style.colorScheme = ctx.theme.mode;
    render();
    refresh();
  });
  host.onDirectory((d) => {
    directory = d;
    refresh();
  });
  host.onSession((s) => {
    session = s;
    render();
    refresh();
  });
  host.onServiceEvent((e) => {
    if (e.topic === "swarm.changed")
      refresh();
  });
  setInterval(refresh, 7000);
  host.onResolve(async ({ command, args }) => {
    if (command !== "swarm")
      return null;
    if (!args?.trim())
      throw Error("Usage: /swarm <task and acceptance criteria>");
    if (!directory)
      throw Error("Open a project first.");
    if (session?.busy)
      throw Error("Wait for the current turn to finish.");
    const s = await api("/start", { task: args.trim(), directory, sessionId: session?.id || null, model: session?.model });
    await host.toast({ kind: "success", message: s.key + " started. Open Swarm from the extension rail." }).catch(() => {});
    return null;
  });
})();
