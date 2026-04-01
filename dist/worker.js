// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  };
};

// src/types/config.ts
var DEFAULT_CONFIG = {
  endpoints: [],
  proxyApiKeys: [],
  requireProxyAuth: false
};

// src/storage/kv-store.ts
var CONFIG_KEY = "proxy_config_v1";
var KVStore = class {
  constructor(kv) {
    this.kv = kv;
  }
  async getConfig() {
    const raw2 = await this.kv.get(CONFIG_KEY);
    if (!raw2) return structuredClone(DEFAULT_CONFIG);
    try {
      return JSON.parse(raw2);
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }
  async setConfig(config) {
    await this.kv.put(CONFIG_KEY, JSON.stringify(config));
  }
};

// src/storage/memory-store.ts
var memoryConfig = structuredClone(DEFAULT_CONFIG);
var MemoryStore = class {
  async getConfig() {
    return structuredClone(memoryConfig);
  }
  async setConfig(config) {
    memoryConfig = structuredClone(config);
  }
};
var globalMemoryStore = new MemoryStore();

// src/storage/index.ts
function createStore(c) {
  const env = c.env;
  if (env && "CONFIG_KV" in env && env["CONFIG_KV"]) {
    return new KVStore(env["CONFIG_KV"]);
  }
  return globalMemoryStore;
}

// src/middleware/auth.ts
async function authMiddleware(c, next) {
  const apiKey = c.req.header("x-elastic-api-key");
  const baseUrl = c.req.header("x-elastic-base-url");
  const inferenceId = c.req.header("x-elastic-inference-id");
  if (apiKey && baseUrl && inferenceId) {
    try {
      const parsed = new URL(baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Invalid x-elastic-base-url: must be a valid HTTP/HTTPS URL"
          }
        },
        400
      );
    }
    c.set("elastic", {
      apiKey,
      baseUrl: baseUrl.replace(/\/$/, ""),
      inferenceId
    });
    await next();
    return;
  }
  if (apiKey || baseUrl || inferenceId) {
    const missing = [];
    if (!apiKey) missing.push("x-elastic-api-key");
    if (!baseUrl) missing.push("x-elastic-base-url");
    if (!inferenceId) missing.push("x-elastic-inference-id");
    return c.json(
      {
        error: {
          type: "authentication_error",
          message: `Missing required headers: ${missing.join(", ")}`
        }
      },
      401
    );
  }
  let model;
  try {
    const cloned = c.req.raw.clone();
    const body = await cloned.json();
    if (typeof body.model === "string") {
      model = body.model;
    }
  } catch {
  }
  if (!model) {
    return c.json(
      {
        error: {
          type: "authentication_error",
          message: "Provide x-elastic-* headers, or configure endpoints in the admin panel and include a model field in the request body"
        }
      },
      401
    );
  }
  const store = createStore(c);
  const config = await store.getConfig();
  const endpoint = config.endpoints.find(
    (ep) => ep.enabled && ep.models.includes(model)
  );
  if (!endpoint) {
    return c.json(
      {
        error: {
          type: "authentication_error",
          message: `No enabled endpoint configured for model: "${model}". Please add it in the admin panel.`
        }
      },
      401
    );
  }
  c.set("elastic", {
    apiKey: endpoint.apiKey,
    baseUrl: endpoint.baseUrl,
    inferenceId: endpoint.inferenceId
  });
  await next();
}

// src/converters/openai-to-elastic.ts
function openaiToElastic(req) {
  const result = {
    messages: req.messages.map(convertMessage)
  };
  const maxTokens = req.max_completion_tokens ?? req.max_tokens;
  if (maxTokens !== void 0) {
    result.max_completion_tokens = maxTokens;
  }
  if (req.temperature !== void 0) result.temperature = req.temperature;
  if (req.top_p !== void 0) result.top_p = req.top_p;
  if (req.stop !== void 0) {
    result.stop = Array.isArray(req.stop) ? req.stop : [req.stop];
  }
  if (req.tools && req.tools.length > 0) {
    result.tools = req.tools;
  }
  if (req.tool_choice !== void 0) {
    result.tool_choice = req.tool_choice;
  }
  if (req.reasoning) {
    result.reasoning = convertReasoning(req.reasoning);
  }
  return result;
}
function convertMessage(msg) {
  const result = {
    role: msg.role,
    content: msg.content ?? null
  };
  if (msg.tool_call_id) result.tool_call_id = msg.tool_call_id;
  if (msg.tool_calls && msg.tool_calls.length > 0) result.tool_calls = msg.tool_calls;
  return result;
}
function convertReasoning(r) {
  const result = {};
  if (r.effort !== void 0) result.effort = r.effort;
  if (r.max_tokens !== void 0) result.max_tokens = r.max_tokens;
  if (r.enabled !== void 0) result.enabled = r.enabled;
  if (r.summary !== void 0) result.summary = r.summary;
  if (r.exclude !== void 0) result.exclude = r.exclude;
  return result;
}

// src/utils/elastic-client.ts
function buildElasticUrl(ctx) {
  return `${ctx.baseUrl}/_inference/chat_completion/${ctx.inferenceId}/_stream`;
}
async function callElastic(ctx, body) {
  const url = buildElasticUrl(ctx);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${ctx.apiKey}`,
        Accept: "text/event-stream"
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ElasticUpstreamError(0, `Network error: ${message}`);
  }
  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {
    }
    throw new ElasticUpstreamError(response.status, errorText);
  }
  return response;
}
var ElasticUpstreamError = class extends Error {
  constructor(status, body) {
    super(`Elastic upstream error ${status}: ${body}`);
    this.status = status;
    this.body = body;
    this.name = "ElasticUpstreamError";
  }
};

// src/utils/sse.ts
async function* parseSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\n\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSSEBlock(block);
        if (parsed) yield parsed;
      }
    }
    if (buffer.trim()) {
      const parsed = parseSSEBlock(buffer);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}
function parseSSEBlock(block) {
  const lines = block.split("\n");
  let event;
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      data = line.slice(6);
    } else if (line.startsWith("data:")) {
      data = line.slice(5);
    }
  }
  if (!data) return null;
  return { event, data };
}
function formatSSE(data, event) {
  if (event) {
    return `event: ${event}
data: ${data}

`;
  }
  return `data: ${data}

`;
}

// src/streaming/elastic-reader.ts
async function* readElasticStream(responseBody) {
  for await (const { data } of parseSSE(responseBody)) {
    if (data.trim() === "[DONE]") {
      yield "DONE";
      return;
    }
    if (!data.trim() || data.startsWith(":")) {
      continue;
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed !== null && typeof parsed === "object" && "chat_completion" in parsed) {
        yield parsed;
      }
    } catch {
      continue;
    }
  }
}

// src/streaming/openai-writer.ts
function elasticToOpenAIStream(elasticBody) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const enqueue = (text) => controller.enqueue(encoder.encode(text));
      try {
        for await (const chunk of readElasticStream(elasticBody)) {
          if (chunk === "DONE") {
            enqueue(formatSSE("[DONE]"));
            break;
          }
          const cc = chunk.chat_completion;
          const openaiChunk = {
            id: cc.id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1e3),
            model: cc.model,
            choices: cc.choices.map((choice) => ({
              index: choice.index,
              delta: {
                // role 仅在第一个 chunk 中出现
                ...choice.delta.role !== void 0 && { role: choice.delta.role },
                // content: null 也需要透传 (finish_reason chunk 中 content 为 null)
                ...choice.delta.content !== void 0 && { content: choice.delta.content },
                // Elastic reasoning → OpenAI reasoning_content (兼容 o 系列)
                ...choice.delta.reasoning !== void 0 && {
                  reasoning_content: choice.delta.reasoning
                },
                // tool_calls 格式与 OpenAI 一致，直接透传
                ...choice.delta.tool_calls !== void 0 && {
                  tool_calls: choice.delta.tool_calls
                }
              },
              finish_reason: choice.finish_reason ?? null
            })),
            // usage 仅在最后一个 chunk 中出现
            ...cc.usage !== void 0 && { usage: cc.usage }
          };
          enqueue(formatSSE(JSON.stringify(openaiChunk)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream processing error";
        const errorChunk = {
          error: { type: "proxy_error", message }
        };
        enqueue(formatSSE(JSON.stringify(errorChunk)));
      } finally {
        controller.close();
      }
    }
  });
}
async function elasticToOpenAIComplete(elasticBody) {
  let id = "";
  let model = "";
  let usage;
  const choiceMap = /* @__PURE__ */ new Map();
  const getOrCreateChoice = (index) => {
    if (!choiceMap.has(index)) {
      choiceMap.set(index, {
        content: "",
        reasoning: "",
        toolCallMap: /* @__PURE__ */ new Map(),
        finishReason: "stop"
      });
    }
    return choiceMap.get(index);
  };
  for await (const chunk of readElasticStream(elasticBody)) {
    if (chunk === "DONE") break;
    const cc = chunk.chat_completion;
    if (!id) id = cc.id;
    if (!model) model = cc.model;
    if (cc.usage) usage = cc.usage;
    for (const choice of cc.choices) {
      const c = getOrCreateChoice(choice.index);
      if (choice.delta.content) c.content += choice.delta.content;
      if (choice.delta.reasoning) c.reasoning += choice.delta.reasoning;
      if (choice.finish_reason) c.finishReason = choice.finish_reason;
      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const tIdx = tc.index ?? 0;
          if (!c.toolCallMap.has(tIdx)) {
            c.toolCallMap.set(tIdx, {
              id: tc.id,
              name: tc.function.name,
              arguments: ""
            });
          }
          const existing = c.toolCallMap.get(tIdx);
          existing.arguments += tc.function.arguments ?? "";
        }
      }
    }
  }
  const choices = [...choiceMap.entries()].sort(([a], [b]) => a - b).map(([index, c]) => {
    const toolCalls = c.toolCallMap.size > 0 ? [...c.toolCallMap.entries()].sort(([a], [b]) => a - b).map(([, tc]) => ({
      id: tc.id,
      type: "function",
      function: { name: tc.name, arguments: tc.arguments }
    })) : void 0;
    return {
      index,
      message: {
        role: "assistant",
        content: c.content || null,
        ...toolCalls && { tool_calls: toolCalls },
        ...c.reasoning && { reasoning_content: c.reasoning }
      },
      finish_reason: c.finishReason
    };
  });
  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1e3),
    model,
    choices,
    ...usage !== void 0 && {
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens
      }
    }
  };
}

// src/routes/openai.ts
var openaiRouter = new Hono2();
openaiRouter.use("*", authMiddleware);
openaiRouter.post("/v1/chat/completions", async (c) => {
  const elastic = c.get("elastic");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { type: "invalid_request_error", message: "Invalid JSON body" } },
      400
    );
  }
  if (!body.model) {
    return c.json(
      { error: { type: "invalid_request_error", message: '"model" is required' } },
      400
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json(
      {
        error: {
          type: "invalid_request_error",
          message: '"messages" must be a non-empty array'
        }
      },
      400
    );
  }
  const elasticBody = openaiToElastic(body);
  let elasticResp;
  try {
    elasticResp = await callElastic(elastic, elasticBody);
  } catch (err) {
    if (err instanceof ElasticUpstreamError) {
      const status = err.status === 0 ? 502 : err.status;
      return c.json(
        { error: { type: "upstream_error", message: err.body || err.message } },
        status
      );
    }
    throw err;
  }
  if (body.stream !== false) {
    const outputStream = elasticToOpenAIStream(elasticResp.body);
    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const completion = await elasticToOpenAIComplete(elasticResp.body);
    return c.json(completion);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process response";
    return c.json(
      { error: { type: "proxy_error", message } },
      500
    );
  }
});

// src/converters/anthropic-to-elastic.ts
function anthropicToElastic(req) {
  const messages = [];
  if (req.system) {
    messages.push({ role: "system", content: req.system });
  }
  for (const msg of req.messages) {
    const converted = convertAnthropicMessage(msg);
    messages.push(...converted);
  }
  const result = {
    messages,
    max_completion_tokens: req.max_tokens
  };
  if (req.temperature !== void 0) result.temperature = req.temperature;
  if (req.top_p !== void 0) result.top_p = req.top_p;
  if (req.stop_sequences && req.stop_sequences.length > 0) {
    result.stop = req.stop_sequences;
  }
  if (req.tools && req.tools.length > 0) {
    result.tools = req.tools.map(convertTool);
  }
  if (req.tool_choice) {
    result.tool_choice = convertToolChoice(req.tool_choice);
  }
  if (req.thinking?.type === "enabled") {
    result.reasoning = {
      enabled: true,
      max_tokens: req.thinking.budget_tokens
    };
  }
  return result;
}
function convertAnthropicMessage(msg) {
  if (typeof msg.content === "string") {
    return [{ role: msg.role, content: msg.content }];
  }
  const blocks = msg.content;
  if (msg.role === "assistant") {
    return convertAssistantBlocks(blocks);
  }
  if (msg.role === "user") {
    return convertUserBlocks(blocks);
  }
  return [];
}
function convertAssistantBlocks(blocks) {
  const textParts = [];
  const toolCalls = [];
  const reasoningParts = [];
  let toolCallIndex = 0;
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        textParts.push(block.text);
        break;
      case "tool_use":
        toolCalls.push({
          id: block.id,
          type: "function",
          index: toolCallIndex++,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
        break;
      case "thinking":
        reasoningParts.push(block.thinking);
        break;
      case "redacted_thinking":
        break;
    }
  }
  const message = {
    role: "assistant",
    content: textParts.join("") || null
  };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;
  if (reasoningParts.length > 0) message.reasoning = reasoningParts.join("\n");
  return [message];
}
function convertUserBlocks(blocks) {
  const toolResultMessages = [];
  const userContentParts = [];
  for (const block of blocks) {
    switch (block.type) {
      case "tool_result": {
        let toolContent;
        if (typeof block.content === "string") {
          toolContent = block.content;
        } else if (Array.isArray(block.content)) {
          toolContent = block.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        } else {
          toolContent = "";
        }
        toolResultMessages.push({
          role: "tool",
          content: toolContent,
          tool_call_id: block.tool_use_id
        });
        break;
      }
      case "text":
        userContentParts.push(block.text);
        break;
      case "image":
        break;
    }
  }
  const results = [...toolResultMessages];
  if (userContentParts.length > 0) {
    results.push({ role: "user", content: userContentParts.join("") });
  }
  return results;
}
function convertTool(tool) {
  return {
    type: "function",
    function: {
      name: tool.name,
      ...tool.description && { description: tool.description },
      parameters: tool.input_schema
    }
  };
}
function convertToolChoice(tc) {
  switch (tc.type) {
    case "auto":
      return "auto";
    case "any":
      return "required";
    case "tool":
      return { type: "function", function: { name: tc.name } };
  }
}

// src/streaming/anthropic-writer.ts
function elasticToAnthropicStream(elasticBody) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const enqueue = (event) => controller.enqueue(
        encoder.encode(formatSSE(JSON.stringify(event), event.type))
      );
      let messageStartSent = false;
      let messageId = "";
      let model = "";
      let usage;
      let finalFinishReason = "end_turn";
      let nextContentIndex = 0;
      const openBlocks = /* @__PURE__ */ new Map();
      let thinkingBlockIndex = -1;
      let textBlockIndex = -1;
      const toolIndexMap = /* @__PURE__ */ new Map();
      try {
        for await (const chunk of readElasticStream(elasticBody)) {
          if (chunk === "DONE") break;
          const cc = chunk.chat_completion;
          if (!messageId) messageId = cc.id;
          if (!model) model = cc.model;
          if (cc.usage) usage = cc.usage;
          if (!messageStartSent) {
            messageStartSent = true;
            enqueue({
              type: "message_start",
              message: {
                id: cc.id,
                type: "message",
                role: "assistant",
                content: [],
                model: cc.model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
              }
            });
          }
          for (const choice of cc.choices) {
            const { delta, finish_reason } = choice;
            if (finish_reason) {
              finalFinishReason = mapFinishReason(finish_reason);
            }
            if (delta.reasoning !== void 0 && delta.reasoning !== "") {
              if (thinkingBlockIndex === -1) {
                thinkingBlockIndex = nextContentIndex++;
                const startEvent = {
                  type: "content_block_start",
                  index: thinkingBlockIndex,
                  content_block: { type: "thinking", thinking: "" }
                };
                enqueue(startEvent);
                openBlocks.set(thinkingBlockIndex, "thinking");
              }
              enqueue({
                type: "content_block_delta",
                index: thinkingBlockIndex,
                delta: { type: "thinking_delta", thinking: delta.reasoning }
              });
            }
            if (delta.content !== void 0 && delta.content !== null && delta.content !== "") {
              if (thinkingBlockIndex !== -1 && openBlocks.has(thinkingBlockIndex)) {
                enqueue({ type: "content_block_stop", index: thinkingBlockIndex });
                openBlocks.delete(thinkingBlockIndex);
              }
              if (textBlockIndex === -1) {
                textBlockIndex = nextContentIndex++;
                const startEvent = {
                  type: "content_block_start",
                  index: textBlockIndex,
                  content_block: { type: "text", text: "" }
                };
                enqueue(startEvent);
                openBlocks.set(textBlockIndex, "text");
              }
              enqueue({
                type: "content_block_delta",
                index: textBlockIndex,
                delta: { type: "text_delta", text: delta.content }
              });
            }
            if (delta.tool_calls && delta.tool_calls.length > 0) {
              for (const tc of delta.tool_calls) {
                const elasticToolIdx = tc.index ?? 0;
                if (!toolIndexMap.has(elasticToolIdx)) {
                  if (thinkingBlockIndex !== -1 && openBlocks.has(thinkingBlockIndex)) {
                    enqueue({ type: "content_block_stop", index: thinkingBlockIndex });
                    openBlocks.delete(thinkingBlockIndex);
                  }
                  if (textBlockIndex !== -1 && openBlocks.has(textBlockIndex)) {
                    enqueue({ type: "content_block_stop", index: textBlockIndex });
                    openBlocks.delete(textBlockIndex);
                  }
                  const blockIdx = nextContentIndex++;
                  toolIndexMap.set(elasticToolIdx, blockIdx);
                  const startEvent = {
                    type: "content_block_start",
                    index: blockIdx,
                    content_block: {
                      type: "tool_use",
                      id: tc.id,
                      name: tc.function.name,
                      input: {}
                    }
                  };
                  enqueue(startEvent);
                  openBlocks.set(blockIdx, "tool_use");
                }
                if (tc.function.arguments) {
                  const blockIdx = toolIndexMap.get(elasticToolIdx);
                  enqueue({
                    type: "content_block_delta",
                    index: blockIdx,
                    delta: {
                      type: "input_json_delta",
                      partial_json: tc.function.arguments
                    }
                  });
                }
              }
            }
          }
        }
        if (!messageStartSent) {
          enqueue({
            type: "message_start",
            message: {
              id: messageId || "msg_unknown",
              type: "message",
              role: "assistant",
              content: [],
              model: model || "unknown",
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 }
            }
          });
        }
        const sortedOpenBlocks = [...openBlocks.entries()].sort(([a], [b]) => a - b);
        for (const [idx] of sortedOpenBlocks) {
          enqueue({ type: "content_block_stop", index: idx });
        }
        enqueue({
          type: "message_delta",
          delta: {
            stop_reason: finalFinishReason,
            stop_sequence: null
          },
          usage: { output_tokens: usage?.completion_tokens ?? 0 }
        });
        enqueue({ type: "message_stop" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream processing error";
        enqueue({
          type: "error",
          error: { type: "api_error", message }
        });
      } finally {
        controller.close();
      }
    }
  });
}
function mapFinishReason(reason) {
  const map = {
    stop: "end_turn",
    tool_calls: "tool_use",
    length: "max_tokens",
    content_filter: "stop_sequence",
    max_tokens: "max_tokens"
  };
  return map[reason] ?? "end_turn";
}

// src/routes/anthropic.ts
var anthropicRouter = new Hono2();
anthropicRouter.use("*", authMiddleware);
anthropicRouter.post("/v1/messages", async (c) => {
  const elastic = c.get("elastic");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        type: "error",
        error: { type: "invalid_request_error", message: "Invalid JSON body" }
      },
      400
    );
  }
  if (!body.model) {
    return c.json(
      {
        type: "error",
        error: { type: "invalid_request_error", message: '"model" is required' }
      },
      400
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: '"messages" must be a non-empty array'
        }
      },
      400
    );
  }
  if (!body.max_tokens || body.max_tokens <= 0) {
    return c.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: '"max_tokens" must be a positive integer'
        }
      },
      400
    );
  }
  const elasticBody = anthropicToElastic(body);
  let elasticResp;
  try {
    elasticResp = await callElastic(elastic, elasticBody);
  } catch (err) {
    if (err instanceof ElasticUpstreamError) {
      const status = err.status === 0 ? 502 : err.status;
      return c.json(
        {
          type: "error",
          error: { type: "api_error", message: err.body || err.message }
        },
        status
      );
    }
    throw err;
  }
  if (body.stream !== false) {
    const outputStream = elasticToAnthropicStream(elasticResp.body);
    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        // Anthropic SDK 需要的版本头
        "anthropic-version": "2023-06-01"
      }
    });
  }
  try {
    const response = await aggregateAnthropicResponse(
      elasticResp.body,
      body.model
    );
    return c.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process response";
    return c.json(
      { type: "error", error: { type: "api_error", message } },
      500
    );
  }
});
async function aggregateAnthropicResponse(body, model) {
  let id = "";
  let responseModel = model;
  let inputTokens = 0;
  let outputTokens = 0;
  let finalFinishReason = "end_turn";
  let textContent = "";
  let reasoningContent = "";
  const toolCallMap = /* @__PURE__ */ new Map();
  for await (const chunk of readElasticStream(body)) {
    if (chunk === "DONE") break;
    const cc = chunk.chat_completion;
    if (!id) id = cc.id;
    if (cc.model) responseModel = cc.model;
    if (cc.usage) {
      inputTokens = cc.usage.prompt_tokens;
      outputTokens = cc.usage.completion_tokens;
    }
    for (const choice of cc.choices) {
      if (choice.finish_reason) {
        finalFinishReason = mapFinishReason2(
          choice.finish_reason
        );
      }
      if (choice.delta.content) textContent += choice.delta.content;
      if (choice.delta.reasoning) reasoningContent += choice.delta.reasoning;
      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const tIdx = tc.index ?? 0;
          if (!toolCallMap.has(tIdx)) {
            toolCallMap.set(tIdx, { id: tc.id, name: tc.function.name, arguments: "" });
          }
          toolCallMap.get(tIdx).arguments += tc.function.arguments ?? "";
        }
      }
    }
  }
  const content = [];
  if (reasoningContent) {
    content.push({ type: "thinking", thinking: reasoningContent });
  }
  if (textContent) {
    content.push({ type: "text", text: textContent });
  }
  if (toolCallMap.size > 0) {
    const sorted = [...toolCallMap.entries()].sort(([a], [b]) => a - b);
    for (const [, tc] of sorted) {
      let input = {};
      try {
        input = JSON.parse(tc.arguments);
      } catch {
      }
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input
      });
    }
  }
  return {
    id,
    type: "message",
    role: "assistant",
    model: responseModel,
    content,
    stop_reason: finalFinishReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens
    }
  };
}
function mapFinishReason2(reason) {
  const map = {
    stop: "end_turn",
    tool_calls: "tool_use",
    length: "max_tokens",
    max_tokens: "max_tokens",
    content_filter: "stop_sequence"
  };
  return map[reason] ?? "end_turn";
}

// node_modules/hono/dist/utils/cookie.js
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var parse = (cookie, name) => {
  if (name && cookie.indexOf(name) === -1) {
    return {};
  }
  const pairs = cookie.trim().split(";");
  const parsedCookie = {};
  for (let pairStr of pairs) {
    pairStr = pairStr.trim();
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) {
      continue;
    }
    const cookieName = pairStr.substring(0, valueStartPos).trim();
    if (name && name !== cookieName || !validCookieNameRegEx.test(cookieName)) {
      continue;
    }
    let cookieValue = pairStr.substring(valueStartPos + 1).trim();
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = cookieValue.indexOf("%") !== -1 ? tryDecode(cookieValue, decodeURIComponent_) : cookieValue;
      if (name) {
        break;
      }
    }
  }
  return parsedCookie;
};
var _serialize = (name, value, opt = {}) => {
  let cookie = `${name}=${value}`;
  if (name.startsWith("__Secure-") && !opt.secure) {
    throw new Error("__Secure- Cookie must have Secure attributes");
  }
  if (name.startsWith("__Host-")) {
    if (!opt.secure) {
      throw new Error("__Host- Cookie must have Secure attributes");
    }
    if (opt.path !== "/") {
      throw new Error('__Host- Cookie must have Path attributes with "/"');
    }
    if (opt.domain) {
      throw new Error("__Host- Cookie must not have Domain attributes");
    }
  }
  for (const key of ["domain", "path"]) {
    if (opt[key] && /[;\r\n]/.test(opt[key])) {
      throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
    }
  }
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) {
      throw new Error(
        "Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration."
      );
    }
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") {
    cookie += `; Domain=${opt.domain}`;
  }
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) {
      throw new Error(
        "Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future."
      );
    }
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  if (opt.priority) {
    cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  }
  if (opt.partitioned) {
    if (!opt.secure) {
      throw new Error("Partitioned Cookie must have Secure attributes");
    }
    cookie += "; Partitioned";
  }
  return cookie;
};
var serialize = (name, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name, value, opt);
};

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = (c, key, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key === "string") {
    if (!cookie) {
      return void 0;
    }
    let finalKey = key;
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
    const obj2 = parse(cookie, finalKey);
    return obj2[finalKey];
  }
  if (!cookie) {
    return {};
  }
  const obj = parse(cookie);
  return obj;
};
var generateCookie = (name, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name, value, { path: "/", ...opt, secure: true });
  } else if (opt?.prefix === "host") {
    cookie = serialize("__Host-" + name, value, {
      ...opt,
      path: "/",
      secure: true,
      domain: void 0
    });
  } else {
    cookie = serialize(name, value, { path: "/", ...opt });
  }
  return cookie;
};
var setCookie = (c, name, value, opt) => {
  const cookie = generateCookie(name, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
};
var deleteCookie = (c, name, opt) => {
  const deletedCookie = getCookie(c, name, opt?.prefix);
  setCookie(c, name, "", { ...opt, maxAge: 0 });
  return deletedCookie;
};

// src/admin/session.ts
var SESSION_COOKIE = "admin_session";
var SESSION_MAX_AGE = 86400;
var SESSION_VALIDITY_MS = 86400 * 1e3;
async function deriveSigningKey(password) {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const derivedBytes = await crypto.subtle.sign(
    "HMAC",
    passwordKey,
    enc.encode("session-secret-v1")
  );
  return crypto.subtle.importKey(
    "raw",
    derivedBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
async function generateToken(password) {
  const ts = Date.now().toString();
  const key = await deriveSigningKey(password);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password + ts));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const tsB64 = btoa(ts);
  return `${tsB64}.${sigB64}`;
}
async function verifyToken(token, password) {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return false;
  try {
    const tsB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);
    const ts = atob(tsB64);
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const age = Date.now() - parseInt(ts, 10);
    if (isNaN(age) || age > SESSION_VALIDITY_MS || age < 0) return false;
    const key = await deriveSigningKey(password);
    const enc = new TextEncoder();
    return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(password + ts));
  } catch {
    return false;
  }
}

// src/admin/auth-middleware.ts
async function adminAuthMiddleware(c, next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return c.json({ error: "Unauthorized: no session" }, 401);
  }
  const env = c.env;
  const password = (typeof env?.["ADMIN_PASSWORD"] === "string" ? env["ADMIN_PASSWORD"] : void 0) ?? "admin";
  const valid = await verifyToken(token, password);
  if (!valid) {
    return c.json({ error: "Session expired or invalid, please login again" }, 401);
  }
  await next();
}

// src/admin/page.ts
function getAdminPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elastic Proxy \u7BA1\u7406\u63A7\u5236\u53F0</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .modal-overlay { display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.5); z-index: 50;
      align-items: center; justify-content: center; padding: 1rem; }
    .modal-overlay.active { display: flex; }
    #toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      padding: 0.75rem 1.25rem; border-radius: 0.5rem;
      color: white; font-size: 0.875rem; z-index: 9999;
      opacity: 0; transition: opacity 0.3s; pointer-events: none;
    }
    #toast.show { opacity: 1; }
    #toast.success { background: #10b981; }
    #toast.error { background: #ef4444; }
    .toggle-btn { transition: background-color 0.2s; }
    .toggle-thumb { transition: transform 0.2s; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen font-sans">

<!-- ============ \u767B\u5F55\u9875 ============ -->
<div id="loginPage" class="min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
    <div class="text-center mb-7">
      <div class="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-md">
        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <h1 class="text-xl font-bold text-gray-900">Elastic Proxy</h1>
      <p class="text-sm text-gray-500 mt-1">\u7BA1\u7406\u63A7\u5236\u53F0</p>
    </div>
    <div id="loginError"
      class="hidden mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
    </div>
    <div class="space-y-3">
      <input id="passwordInput" type="password" placeholder="\u7BA1\u7406\u5458\u5BC6\u7801"
        class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               bg-gray-50 hover:bg-white transition-colors"
        onkeydown="if(event.key==='Enter')login()">
      <button onclick="login()"
        class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800
               text-white py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
        \u767B\u5F55
      </button>
    </div>
  </div>
</div>

<!-- ============ \u4E3B\u63A7\u5236\u53F0 ============ -->
<div id="mainPage" class="hidden min-h-screen">

  <!-- \u9876\u90E8\u5BFC\u822A -->
  <header class="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <span class="font-semibold text-gray-800 text-sm">Elastic Proxy \u7BA1\u7406</span>
        <span id="storageTag"
          class="hidden text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
          \u5185\u5B58\u5B58\u50A8 (\u91CD\u542F\u540E\u6570\u636E\u4E22\u5931)
        </span>
      </div>
      <button onclick="logout()"
        class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3
               0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        \u767B\u51FA
      </button>
    </div>
  </header>

  <!-- \u4E3B\u5185\u5BB9 -->
  <div class="max-w-4xl mx-auto px-4 pt-6 pb-16">

    <!-- Tab \u5BFC\u822A -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
      <button id="tab-btn-endpoints" onclick="switchTab('endpoints')"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-blue-600 shadow-sm">
        \u7AEF\u70B9\u7BA1\u7406
      </button>
      <button id="tab-btn-proxyauth" onclick="switchTab('proxyauth')"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-600 hover:text-gray-800">
        \u4EE3\u7406\u8BA4\u8BC1
      </button>
    </div>

    <!-- Tab 1: \u7AEF\u70B9\u7BA1\u7406 -->
    <div id="content-endpoints" class="tab-content active">
      <div class="flex items-start justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-gray-900">\u7AEF\u70B9\u914D\u7F6E</h2>
          <p class="text-sm text-gray-500 mt-0.5">
            \u914D\u7F6E Elastic Inference \u7AEF\u70B9\u53CA\u5BF9\u5E94\u7684\u6A21\u578B\u540D\uFF0C\u8BF7\u6C42\u65F6\u81EA\u52A8\u8DEF\u7531
          </p>
        </div>
        <button onclick="openAddEndpointModal()"
          class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700
                 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition-colors shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          \u6DFB\u52A0\u7AEF\u70B9
        </button>
      </div>
      <div id="endpointsList" class="space-y-3">
        <div class="text-center py-8 text-gray-400 text-sm">\u52A0\u8F7D\u4E2D...</div>
      </div>
    </div>

    <!-- Tab 2: \u4EE3\u7406\u8BA4\u8BC1 -->
    <div id="content-proxyauth" class="tab-content">
      <div class="mb-5">
        <h2 class="text-base font-semibold text-gray-900">\u4EE3\u7406 API Key \u8BA4\u8BC1</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          \u542F\u7528\u540E\uFF0C\u8C03\u7528 /v1/* \u63A5\u53E3\u9700\u8981\u643A\u5E26 <code class="bg-gray-100 px-1 rounded text-xs">Authorization: Bearer &lt;key&gt;</code>
        </p>
      </div>

      <!-- \u8BA4\u8BC1\u5F00\u5173 -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-gray-800">\u542F\u7528\u4EE3\u7406\u8BA4\u8BC1</div>
          <div class="text-xs text-gray-500 mt-0.5">\u5F00\u542F\u540E\u4EC5\u914D\u7F6E\u7684 API Key \u53EF\u8BBF\u95EE\u4EE3\u7406\u63A5\u53E3</div>
        </div>
        <button id="proxyAuthToggleBtn" onclick="toggleProxyAuth()" role="switch"
          class="toggle-btn relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 focus:outline-none">
          <span id="proxyAuthToggleThumb"
            class="toggle-thumb inline-block h-4 w-4 transform rounded-full bg-white shadow translate-x-1">
          </span>
        </button>
      </div>

      <!-- API Key \u5217\u8868 -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span class="text-sm font-medium text-gray-800">API Key \u5217\u8868</span>
          <button onclick="openAddKeyModal()"
            class="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            \u6DFB\u52A0
          </button>
        </div>
        <div id="proxyKeysList" class="px-4 py-3">
          <div class="text-sm text-gray-400 py-2">\u52A0\u8F7D\u4E2D...</div>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- ============ \u6DFB\u52A0/\u7F16\u8F91\u7AEF\u70B9 Modal ============ -->
<div id="endpointModal" class="modal-overlay">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
    <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
      <h3 id="epModalTitle" class="text-base font-semibold text-gray-900">\u6DFB\u52A0\u7AEF\u70B9</h3>
      <button onclick="closeEndpointModal()"
        class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="px-6 py-5 space-y-4">
      <input type="hidden" id="epEditId">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          \u540D\u79F0 <span class="text-red-500">*</span>
        </label>
        <input id="epName" type="text" placeholder="\u5982\uFF1AGPT-4o \u751F\u4EA7\u7AEF\u70B9"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Elastic API Key <span class="text-red-500">*</span>
        </label>
        <div class="relative">
          <input id="epApiKey" type="password" placeholder="\u4F60\u7684 Elastic API Key"
            class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 pr-10">
          <button onclick="togglePasswordVisibility('epApiKey', this)"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg class="w-4 h-4 eye-closed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97
                   9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242
                   4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0
                   0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025
                   10.025 0 01-4.132 5.411m0 0L21 21"/>
            </svg>
            <svg class="w-4 h-4 eye-open hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274
                   4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
        </div>
        <p id="epApiKeyHint" class="hidden text-xs text-amber-600 mt-1">
          \u7F16\u8F91\u65F6\u4FDD\u7559\u5F53\u524D\u503C\u5219\u65E0\u9700\u586B\u5199\uFF0C\u7559\u7A7A\u6216\u586B\u5199\u8131\u654F\u503C\u5C06\u4FDD\u7559\u539F Key
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Base URL <span class="text-red-500">*</span>
        </label>
        <input id="epBaseUrl" type="url" placeholder="https://xxxxxx.elastic.cloud"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Inference ID <span class="text-red-500">*</span>
        </label>
        <input id="epInferenceId" type="text" placeholder="my-gpt4o-endpoint"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          \u652F\u6301\u7684\u6A21\u578B\u540D\u79F0
          <span class="text-gray-400 font-normal text-xs">\uFF08\u7528\u9017\u53F7\u5206\u9694\uFF0C\u7559\u7A7A\u5219\u4E0D\u81EA\u52A8\u8DEF\u7531\uFF09</span>
        </label>
        <input id="epModels" type="text" placeholder="gpt-4o, gpt-4o-mini, gpt-4-turbo"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
        <p class="text-xs text-gray-400 mt-1">
          \u8BF7\u6C42\u4E2D\u7684 <code class="bg-gray-100 px-1 rounded">model</code> \u5B57\u6BB5\u5339\u914D\u8FD9\u4E9B\u540D\u79F0\u65F6\u81EA\u52A8\u8DEF\u7531\u5230\u6B64\u7AEF\u70B9
        </p>
      </div>
      <div class="flex items-center gap-2.5 pt-1">
        <input id="epEnabled" type="checkbox" checked
          class="w-4 h-4 text-blue-600 rounded accent-blue-600">
        <label class="text-sm text-gray-700">\u542F\u7528\u6B64\u7AEF\u70B9</label>
      </div>
    </div>
    <div class="px-6 py-4 border-t border-gray-100 flex gap-2.5 justify-end">
      <button onclick="closeEndpointModal()"
        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200
               rounded-xl transition-colors hover:bg-gray-50">
        \u53D6\u6D88
      </button>
      <button onclick="saveEndpoint()"
        class="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700
               text-white rounded-xl transition-colors">
        \u4FDD\u5B58
      </button>
    </div>
  </div>
</div>

<!-- ============ \u6DFB\u52A0\u4EE3\u7406 API Key Modal ============ -->
<div id="keyModal" class="modal-overlay">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
    <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <h3 class="text-base font-semibold text-gray-900">\u6DFB\u52A0\u4EE3\u7406 API Key</h3>
      <button onclick="closeKeyModal()"
        class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="px-6 py-5">
      <label class="block text-sm font-medium text-gray-700 mb-1.5">
        API Key <span class="text-red-500">*</span>
      </label>
      <input id="newProxyKey" type="text" placeholder="sk-proxy-..."
        class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      <div class="flex items-center justify-between mt-2">
        <p class="text-xs text-gray-400">\u81F3\u5C11 8 \u4E2A\u5B57\u7B26</p>
        <button onclick="generateRandomKey()"
          class="text-xs text-blue-600 hover:text-blue-700 font-medium">
          \u968F\u673A\u751F\u6210
        </button>
      </div>
    </div>
    <div class="px-6 py-4 border-t border-gray-100 flex gap-2.5 justify-end">
      <button onclick="closeKeyModal()"
        class="px-4 py-2 text-sm text-gray-600 border border-gray-200
               rounded-xl hover:bg-gray-50 transition-colors">
        \u53D6\u6D88
      </button>
      <button onclick="saveProxyKey()"
        class="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700
               text-white rounded-xl transition-colors">
        \u6DFB\u52A0
      </button>
    </div>
  </div>
</div>

<!-- ============ Toast \u901A\u77E5 ============ -->
<div id="toast"></div>

<script>
// \u2500\u2500\u2500 \u72B6\u6001 \u2500\u2500\u2500
let proxyAuthEnabled = false;
// proxyKeysFull \u5B58\u50A8\u539F\u59CB key\uFF08\u6DFB\u52A0\u65F6\u6682\u5B58\uFF0C\u7528\u4E8E\u5220\u9664\u65F6\u53D1\u9001\u7ED9\u670D\u52A1\u7AEF\uFF09
const proxyKeysFull = [];
// \u7528\u4E8E\u5728\u5217\u8868\u4E2D\u7528\u539F\u59CB key \u5339\u914D\u5220\u9664
const proxyKeysMasked = [];

// \u2500\u2500\u2500 Toast \u2500\u2500\u2500
let toastTimer = null;
function showToast(msg, type) {
  if (type === undefined) type = 'success';
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = \`show \${type}\`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = type; }, 3000);
}

// \u2500\u2500\u2500 \u5DE5\u5177\uFF1AXSS \u8F6C\u4E49 \u2500\u2500\u2500
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// \u2500\u2500\u2500 Tab \u5207\u6362 \u2500\u2500\u2500
function switchTab(tab) {
  ['endpoints', 'proxyauth'].forEach(function(t) {
    document.getElementById(\`content-\${t}\`).classList.toggle('active', t === tab);
    const btn = document.getElementById(\`tab-btn-\${t}\`);
    if (t === tab) {
      btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
      btn.classList.remove('text-gray-600', 'hover:text-gray-800');
    } else {
      btn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
      btn.classList.add('text-gray-600', 'hover:text-gray-800');
    }
  });
}

// \u2500\u2500\u2500 \u767B\u5F55 \u2500\u2500\u2500
async function login() {
  const pw = document.getElementById('passwordInput').value;
  const errEl = document.getElementById('loginError');
  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) {
      const msg = '\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5';
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      document.getElementById('passwordInput').select();
      return;
    }
    errEl.classList.add('hidden');
    showMainPage();
  } catch(e) {
    errEl.textContent = '\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5';
    errEl.classList.remove('hidden');
  }
}

// \u2500\u2500\u2500 \u767B\u51FA \u2500\u2500\u2500
async function logout() {
  await fetch('/admin/logout', { method: 'POST' });
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('passwordInput').value = '';
}

// \u2500\u2500\u2500 \u663E\u793A\u4E3B\u9875 \u2500\u2500\u2500
function showMainPage() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');
  loadAll();
}

// \u2500\u2500\u2500 \u52A0\u8F7D\u6240\u6709\u6570\u636E \u2500\u2500\u2500
async function loadAll() {
  await Promise.all([loadEndpoints(), loadProxyKeys()]);
  // \u68C0\u6D4B\u5B58\u50A8\u7C7B\u578B\uFF08\u901A\u8FC7\u54CD\u5E94\u5934\u6216 URL \u68C0\u6D4B\uFF0C\u8FD9\u91CC\u7528\u7B80\u5355\u7684\u6807\u8BB0\uFF09
  checkStorageType();
}

async function checkStorageType() {
  // \u5982\u679C\u662F\u672C\u5730\u5F00\u53D1\u73AF\u5883\u6216 vercel \u73AF\u5883\uFF0C\u663E\u793A\u5185\u5B58\u5B58\u50A8\u8B66\u544A
  const host = window.location.hostname;
  const isVercel = host.endsWith('.vercel.app') || host.endsWith('.now.sh');
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isVercel || isLocal) {
    // \u901A\u8FC7\u5065\u5EB7\u68C0\u67E5\u63A5\u53E3\u5224\u65AD
    try {
      const res = await fetch('/health');
      const data = await res.json();
      if (data.storage !== 'kv') {
        document.getElementById('storageTag').classList.remove('hidden');
      }
    } catch {}
  }
}

// \u2500\u2500\u2500 \u7AEF\u70B9\u7BA1\u7406 \u2500\u2500\u2500
async function loadEndpoints() {
  try {
    const res = await fetch('/admin/api/endpoints');
    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      return;
    }
    const endpoints = await res.json();
    renderEndpoints(endpoints);
  } catch(e) {
    document.getElementById('endpointsList').innerHTML =
      '<div class="text-sm text-red-500 py-4">\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5</div>';
  }
}

function renderEndpoints(endpoints) {
  const list = document.getElementById('endpointsList');
  if (!endpoints.length) {
    list.innerHTML = \`
      <div class="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
        <svg class="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        <p class="text-sm text-gray-400">\u6682\u65E0\u7AEF\u70B9\u914D\u7F6E</p>
        <p class="text-xs text-gray-400 mt-1">\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u6DFB\u52A0\u7AEF\u70B9\u300D\u5F00\u59CB\u914D\u7F6E</p>
      </div>\`;
    return;
  }
  list.innerHTML = endpoints.map(function(ep) {
    const modelTags = ep.models.length
      ? ep.models.map(function(m) {
          return \`<span class="bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2 py-0.5 rounded-full font-mono">\${esc(m)}</span>\`;
        }).join('')
      : \`<span class="text-xs text-amber-500">\u672A\u914D\u7F6E\u6A21\u578B\u540D</span>\`;

    return \`<div class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <span class="font-medium text-gray-800 text-sm">\${esc(ep.name)}</span>
            <span class="\${ep.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'} text-xs px-2 py-0.5 rounded-full font-medium border">
              \${ep.enabled ? '\u542F\u7528' : '\u7981\u7528'}
            </span>
          </div>
          <div class="space-y-1 text-xs text-gray-500 mb-3">
            <div class="flex items-center gap-1.5">
              <span class="text-gray-400 shrink-0">URL</span>
              <span class="truncate font-mono text-gray-600">\${esc(ep.baseUrl)}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-gray-400 shrink-0">ID</span>
              <span class="truncate font-mono text-gray-600">\${esc(ep.inferenceId)}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-gray-400 shrink-0">Key</span>
              <span class="font-mono text-gray-600">\${esc(ep.apiKey)}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">\${modelTags}</div>
        </div>
        <div class="flex items-center gap-0.5 shrink-0">
          <button onclick="toggleEndpointEnabled('\${esc(ep.id)}', \${!ep.enabled})"
            title="\${ep.enabled ? '\u7981\u7528' : '\u542F\u7528'}"
            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            \${ep.enabled
              ? \`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                     d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>\`
              : \`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                     d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>\`
            }
          </button>
          <button onclick='editEndpoint(\${JSON.stringify(ep).replace(/\\\\/g, "\\\\\\\\").replace(/'/g, "\\\\'")})'
            title="\u7F16\u8F91"
            class="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2
                   2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="deleteEndpoint('\${esc(ep.id)}')"
            title="\u5220\u9664"
            class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5
                   4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>\`;
  }).join('');
}

// \u6253\u5F00\u6DFB\u52A0\u7AEF\u70B9 Modal
function openAddEndpointModal() {
  document.getElementById('epModalTitle').textContent = '\u6DFB\u52A0\u7AEF\u70B9';
  document.getElementById('epEditId').value = '';
  document.getElementById('epName').value = '';
  document.getElementById('epApiKey').value = '';
  document.getElementById('epApiKey').type = 'password';
  document.getElementById('epBaseUrl').value = '';
  document.getElementById('epInferenceId').value = '';
  document.getElementById('epModels').value = '';
  document.getElementById('epEnabled').checked = true;
  document.getElementById('epApiKeyHint').classList.add('hidden');
  document.getElementById('endpointModal').classList.add('active');
  setTimeout(function() { document.getElementById('epName').focus(); }, 100);
}

// \u6253\u5F00\u7F16\u8F91\u7AEF\u70B9 Modal
function editEndpoint(ep) {
  document.getElementById('epModalTitle').textContent = '\u7F16\u8F91\u7AEF\u70B9';
  document.getElementById('epEditId').value = ep.id;
  document.getElementById('epName').value = ep.name;
  document.getElementById('epApiKey').value = ep.apiKey; // \u8131\u654F\u503C
  document.getElementById('epApiKey').type = 'text';
  document.getElementById('epBaseUrl').value = ep.baseUrl;
  document.getElementById('epInferenceId').value = ep.inferenceId;
  document.getElementById('epModels').value = ep.models.join(', ');
  document.getElementById('epEnabled').checked = ep.enabled;
  document.getElementById('epApiKeyHint').classList.remove('hidden');
  document.getElementById('endpointModal').classList.add('active');
}

function closeEndpointModal() {
  document.getElementById('endpointModal').classList.remove('active');
}

async function saveEndpoint() {
  const id = document.getElementById('epEditId').value;
  const apiKey = document.getElementById('epApiKey').value.trim();
  const modelsStr = document.getElementById('epModels').value;

  const payload = {
    name: document.getElementById('epName').value.trim(),
    baseUrl: document.getElementById('epBaseUrl').value.trim(),
    inferenceId: document.getElementById('epInferenceId').value.trim(),
    models: modelsStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
    enabled: document.getElementById('epEnabled').checked,
  };

  if (!payload.name || !payload.baseUrl || !payload.inferenceId) {
    showToast('\u8BF7\u586B\u5199\u540D\u79F0\u3001Base URL \u548C Inference ID', 'error');
    return;
  }

  // \u5904\u7406 API Key\uFF1A
  // \u65B0\u589E\u65F6\u5FC5\u987B\u6709\u503C\uFF1B\u7F16\u8F91\u65F6\u5982\u679C\u662F\u8131\u654F\u503C\u5219\u4E0D\u4F20\uFF08\u670D\u52A1\u7AEF\u4FDD\u7559\u539F\u503C\uFF09
  if (!id) {
    if (!apiKey) { showToast('\u8BF7\u586B\u5199 Elastic API Key', 'error'); return; }
    payload.apiKey = apiKey;
  } else {
    // \u7F16\u8F91\u65F6\uFF0C\u5982\u679C\u7528\u6237\u586B\u4E86\u65B0\u7684\uFF08\u975E\u8131\u654F\uFF09\u503C\uFF0C\u5219\u66F4\u65B0
    if (apiKey && !apiKey.includes('****')) {
      payload.apiKey = apiKey;
    }
    // \u5426\u5219\u4E0D\u4F20 apiKey\uFF0C\u670D\u52A1\u7AEF\u4FDD\u7559\u539F\u503C
  }

  const url = id ? \`/admin/api/endpoints/\${id}\` : '/admin/api/endpoints';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '\u4FDD\u5B58\u5931\u8D25', 'error');
      return;
    }
    showToast(id ? '\u7AEF\u70B9\u5DF2\u66F4\u65B0' : '\u7AEF\u70B9\u5DF2\u6DFB\u52A0');
    closeEndpointModal();
    loadEndpoints();
  } catch(e) {
    showToast('\u7F51\u7EDC\u9519\u8BEF', 'error');
  }
}

async function toggleEndpointEnabled(id, enable) {
  try {
    const res = await fetch(\`/admin/api/endpoints/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enable }),
    });
    if (!res.ok) { showToast('\u64CD\u4F5C\u5931\u8D25', 'error'); return; }
    showToast(enable ? '\u7AEF\u70B9\u5DF2\u542F\u7528' : '\u7AEF\u70B9\u5DF2\u7981\u7528');
    loadEndpoints();
  } catch(e) {
    showToast('\u7F51\u7EDC\u9519\u8BEF', 'error');
  }
}

async function deleteEndpoint(id) {
  if (!confirm('\u786E\u5B9A\u8981\u5220\u9664\u6B64\u7AEF\u70B9\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002')) return;
  try {
    const res = await fetch(\`/admin/api/endpoints/\${id}\`, { method: 'DELETE' });
    if (!res.ok) { showToast('\u5220\u9664\u5931\u8D25', 'error'); return; }
    showToast('\u7AEF\u70B9\u5DF2\u5220\u9664');
    loadEndpoints();
  } catch(e) {
    showToast('\u7F51\u7EDC\u9519\u8BEF', 'error');
  }
}

// \u2500\u2500\u2500 \u4EE3\u7406 API Key \u7BA1\u7406 \u2500\u2500\u2500
async function loadProxyKeys() {
  try {
    const res = await fetch('/admin/api/proxy-keys');
    if (!res.ok) { if (res.status === 401) { logout(); return; } return; }
    const data = await res.json();
    proxyAuthEnabled = data.requireProxyAuth;
    // \u6E05\u7A7A\u5E76\u91CD\u5EFA\u8131\u654F\u5217\u8868
    proxyKeysMasked.length = 0;
    data.keys.forEach(function(k) { proxyKeysMasked.push(k); });
    renderProxyAuthToggle();
    renderProxyKeys();
  } catch(e) {}
}

function renderProxyAuthToggle() {
  const btn = document.getElementById('proxyAuthToggleBtn');
  const thumb = document.getElementById('proxyAuthToggleThumb');
  if (proxyAuthEnabled) {
    btn.classList.replace('bg-gray-200', 'bg-blue-600');
    thumb.style.transform = 'translateX(1.25rem)';
  } else {
    btn.classList.replace('bg-blue-600', 'bg-gray-200');
    thumb.style.transform = 'translateX(0.25rem)';
  }
  btn.setAttribute('aria-checked', String(proxyAuthEnabled));
}

async function toggleProxyAuth() {
  const newVal = !proxyAuthEnabled;
  try {
    const res = await fetch('/admin/api/proxy-auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireProxyAuth: newVal }),
    });
    if (!res.ok) { showToast('\u64CD\u4F5C\u5931\u8D25', 'error'); return; }
    proxyAuthEnabled = newVal;
    renderProxyAuthToggle();
    showToast(newVal ? '\u4EE3\u7406\u8BA4\u8BC1\u5DF2\u542F\u7528' : '\u4EE3\u7406\u8BA4\u8BC1\u5DF2\u7981\u7528');
  } catch(e) {
    showToast('\u7F51\u7EDC\u9519\u8BEF', 'error');
  }
}

function renderProxyKeys() {
  const list = document.getElementById('proxyKeysList');
  if (!proxyKeysMasked.length) {
    list.innerHTML = '<p class="text-sm text-gray-400 py-1">\u6682\u65E0 API Key</p>';
    return;
  }
  list.innerHTML = proxyKeysMasked.map(function(k, i) {
    return \`<div class="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <code class="text-sm font-mono text-gray-700">\${esc(k)}</code>
      <button onclick="deleteProxyKey(\${i})"
        class="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>\`;
  }).join('');
}

function openAddKeyModal() {
  document.getElementById('newProxyKey').value = '';
  document.getElementById('keyModal').classList.add('active');
  setTimeout(function() { document.getElementById('newProxyKey').focus(); }, 100);
}

function closeKeyModal() {
  document.getElementById('keyModal').classList.remove('active');
}

function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk-proxy-';
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  arr.forEach(function(b) { key += chars[b % chars.length]; });
  document.getElementById('newProxyKey').value = key;
}

async function saveProxyKey() {
  const key = document.getElementById('newProxyKey').value.trim();
  if (key.length < 8) { showToast('Key \u81F3\u5C11\u9700\u8981 8 \u4E2A\u5B57\u7B26', 'error'); return; }
  try {
    const res = await fetch('/admin/api/proxy-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '\u6DFB\u52A0\u5931\u8D25', 'error');
      return;
    }
    // \u4FDD\u5B58\u539F\u59CB key \u7528\u4E8E\u540E\u7EED\u5220\u9664
    proxyKeysFull.push(key);
    showToast('API Key \u5DF2\u6DFB\u52A0');
    closeKeyModal();
    loadProxyKeys();
  } catch(e) {
    showToast('\u7F51\u7EDC\u9519\u8BEF', 'error');
  }
}

async function deleteProxyKey(idx) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u6B64 API Key \u5417\uFF1F')) return;

  // \u4F18\u5148\u4F7F\u7528 proxyKeysFull \u4E2D\u7684\u539F\u59CB\u503C
  const rawKey = proxyKeysFull[idx];
  if (!rawKey) {
    showToast('\u65E0\u6CD5\u5220\u9664\uFF1A\u8BF7\u5728\u672C\u6B21\u4F1A\u8BDD\u4E2D\u6DFB\u52A0 Key \u540E\u518D\u5220\u9664\uFF0C\u6216\u91CD\u65B0\u767B\u5F55\u540E\u64CD\u4F5C', 'error');
    return;
  }

  try {
    const res = await fetch('/admin/api/proxy-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: rawKey }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '\u5220\u9664\u5931\u8D25', 'error');
      return;
    }
    proxyKeysFull.splice(idx, 1);
    showToast('API Key \u5DF2\u5220\u9664');
    loadProxyKeys();
  } catch(e) {
    showToast('\u7F51\u7EDC\u9519\u8BEF', 'error');
  }
}

// \u2500\u2500\u2500 \u5BC6\u7801\u6846\u663E\u793A/\u9690\u85CF \u2500\u2500\u2500
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.querySelector('.eye-closed').classList.toggle('hidden', isPassword);
  btn.querySelector('.eye-open').classList.toggle('hidden', !isPassword);
}

// \u2500\u2500\u2500 Modal \u70B9\u51FB\u80CC\u666F\u5173\u95ED \u2500\u2500\u2500
document.getElementById('endpointModal').addEventListener('click', function(e) {
  if (e.target === this) closeEndpointModal();
});
document.getElementById('keyModal').addEventListener('click', function(e) {
  if (e.target === this) closeKeyModal();
});

// \u2500\u2500\u2500 \u521D\u59CB\u5316\uFF1A\u68C0\u67E5\u767B\u5F55\u72B6\u6001 \u2500\u2500\u2500
(async function init() {
  try {
    const res = await fetch('/admin/api/endpoints');
    if (res.ok) {
      showMainPage();
    }
    // 401 = \u672A\u767B\u5F55\uFF0C\u663E\u793A\u767B\u5F55\u9875\uFF08\u9ED8\u8BA4\u5DF2\u663E\u793A\uFF09
  } catch(e) {
    // \u7F51\u7EDC\u9519\u8BEF\uFF0C\u4FDD\u6301\u767B\u5F55\u9875
  }
})();
<\/script>
</body>
</html>`;
}

// src/admin/routes.ts
var adminApp = new Hono2();
adminApp.get("/admin", (c) => {
  return c.html(getAdminPage());
});
adminApp.post("/admin/login", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  const env = c.env;
  const adminPassword = (typeof env?.["ADMIN_PASSWORD"] === "string" ? env["ADMIN_PASSWORD"] : void 0) ?? "admin";
  if (body.password !== adminPassword) {
    return c.json({ error: "Invalid password" }, 401);
  }
  const token = await generateToken(adminPassword);
  const isSecure = c.req.url.startsWith("https://");
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    path: "/"
  });
  return c.json({ ok: true });
});
adminApp.post("/admin/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});
var api = new Hono2();
api.use("*", adminAuthMiddleware);
api.get("/endpoints", async (c) => {
  const store = createStore(c);
  const config = await store.getConfig();
  return c.json(
    config.endpoints.map((ep) => ({ ...ep, apiKey: maskSecret(ep.apiKey) }))
  );
});
api.post("/endpoints", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (!body.name || !body.apiKey || !body.baseUrl || !body.inferenceId) {
    return c.json({ error: "Missing required fields: name, apiKey, baseUrl, inferenceId" }, 400);
  }
  try {
    const u = new URL(body.baseUrl);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error();
  } catch {
    return c.json({ error: "Invalid baseUrl: must be a valid HTTP/HTTPS URL" }, 400);
  }
  const store = createStore(c);
  const config = await store.getConfig();
  const newEp = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    apiKey: body.apiKey.trim(),
    baseUrl: body.baseUrl.trim().replace(/\/$/, ""),
    inferenceId: body.inferenceId.trim(),
    models: Array.isArray(body.models) ? body.models.map((m) => m.trim()).filter(Boolean) : [],
    enabled: body.enabled !== false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  config.endpoints.push(newEp);
  await store.setConfig(config);
  return c.json({ ...newEp, apiKey: maskSecret(newEp.apiKey) }, 201);
});
api.put("/endpoints/:id", async (c) => {
  const id = c.req.param("id");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  const store = createStore(c);
  const config = await store.getConfig();
  const idx = config.endpoints.findIndex((ep) => ep.id === id);
  if (idx === -1) return c.json({ error: "Endpoint not found" }, 404);
  const existing = config.endpoints[idx];
  const apiKey = body.apiKey && !isMasked(body.apiKey) ? body.apiKey.trim() : existing.apiKey;
  const baseUrl = body.baseUrl !== void 0 ? body.baseUrl.trim().replace(/\/$/, "") : existing.baseUrl;
  if (body.baseUrl !== void 0) {
    try {
      const u = new URL(baseUrl);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    } catch {
      return c.json({ error: "Invalid baseUrl: must be a valid HTTP/HTTPS URL" }, 400);
    }
  }
  config.endpoints[idx] = {
    ...existing,
    ...body.name !== void 0 && { name: body.name.trim() },
    ...body.inferenceId !== void 0 && { inferenceId: body.inferenceId.trim() },
    ...body.models !== void 0 && {
      models: body.models.map((m) => m.trim()).filter(Boolean)
    },
    ...body.enabled !== void 0 && { enabled: body.enabled },
    apiKey,
    baseUrl,
    id: existing.id,
    createdAt: existing.createdAt
  };
  await store.setConfig(config);
  return c.json({ ...config.endpoints[idx], apiKey: maskSecret(apiKey) });
});
api.delete("/endpoints/:id", async (c) => {
  const id = c.req.param("id");
  const store = createStore(c);
  const config = await store.getConfig();
  const before = config.endpoints.length;
  config.endpoints = config.endpoints.filter((ep) => ep.id !== id);
  if (config.endpoints.length === before) {
    return c.json({ error: "Endpoint not found" }, 404);
  }
  await store.setConfig(config);
  return c.json({ ok: true });
});
api.get("/proxy-keys", async (c) => {
  const store = createStore(c);
  const config = await store.getConfig();
  return c.json({
    requireProxyAuth: config.requireProxyAuth,
    keys: config.proxyApiKeys.map(maskSecret)
  });
});
api.post("/proxy-keys", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (!body.key || body.key.length < 8) {
    return c.json({ error: "Key must be at least 8 characters" }, 400);
  }
  const store = createStore(c);
  const config = await store.getConfig();
  if (config.proxyApiKeys.includes(body.key)) {
    return c.json({ error: "Key already exists" }, 409);
  }
  config.proxyApiKeys.push(body.key);
  await store.setConfig(config);
  return c.json({ key: maskSecret(body.key) }, 201);
});
api.delete("/proxy-keys", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (!body.key) return c.json({ error: "key is required" }, 400);
  const store = createStore(c);
  const config = await store.getConfig();
  const before = config.proxyApiKeys.length;
  config.proxyApiKeys = config.proxyApiKeys.filter((k) => k !== body.key);
  if (config.proxyApiKeys.length === before) {
    return c.json({ error: "Key not found" }, 404);
  }
  await store.setConfig(config);
  return c.json({ ok: true });
});
api.put("/proxy-auth", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (typeof body.requireProxyAuth !== "boolean") {
    return c.json({ error: "requireProxyAuth must be a boolean" }, 400);
  }
  const store = createStore(c);
  const config = await store.getConfig();
  config.requireProxyAuth = body.requireProxyAuth;
  await store.setConfig(config);
  return c.json({ requireProxyAuth: config.requireProxyAuth });
});
adminApp.route("/admin/api", api);
function maskSecret(s) {
  if (!s) return "****";
  if (s.length <= 8) return "****";
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}
function isMasked(s) {
  return s.includes("****");
}

// src/middleware/proxy-auth.ts
async function proxyAuthMiddleware(c, next) {
  const store = createStore(c);
  const config = await store.getConfig();
  if (!config.requireProxyAuth) {
    await next();
    return;
  }
  const authHeader = c.req.header("Authorization") ?? "";
  const match2 = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match2) {
    return c.json(
      { error: { type: "authentication_error", message: "Missing Bearer token" } },
      401
    );
  }
  const token = match2[1];
  if (!config.proxyApiKeys.includes(token)) {
    return c.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      401
    );
  }
  await next();
}

// src/index.ts
var app = new Hono2();
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "anthropic-version",
      "x-elastic-api-key",
      "x-elastic-base-url",
      "x-elastic-inference-id"
    ],
    exposeHeaders: ["Content-Type"],
    maxAge: 86400
  })
);
app.onError((err, c) => {
  console.error("[proxy error]", err);
  const isAnthropicRoute = c.req.path.startsWith("/v1/messages");
  if (isAnthropicRoute) {
    return c.json(
      { type: "error", error: { type: "proxy_error", message: err.message } },
      500
    );
  }
  return c.json({ error: { type: "proxy_error", message: err.message } }, 500);
});
app.get("/health", (c) => {
  const env = c.env;
  const storage = env && "CONFIG_KV" in env ? "kv" : "memory";
  return c.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    storage,
    routes: [
      "POST /v1/chat/completions  \u2014 OpenAI Chat Completions \u2192 Elastic",
      "POST /v1/messages          \u2014 Anthropic Messages \u2192 Elastic",
      "GET  /admin                \u2014 Management UI"
    ]
  });
});
app.route("/", adminApp);
app.use("/v1/*", proxyAuthMiddleware);
app.route("/", openaiRouter);
app.route("/", anthropicRouter);
app.notFound(
  (c) => c.json(
    {
      error: {
        type: "not_found",
        message: `Route ${c.req.method} ${c.req.path} not found. Available: POST /v1/chat/completions, POST /v1/messages, GET /admin`
      }
    },
    404
  )
);
var index_default = app;
export {
  index_default as default
};
