"use strict";

(function () {
  const MAX_RECTS = 12;
  const TARGET_FPS = 45;
  const FRAME_MS = 1000 / TARGET_FPS;
  const DPR_CAP = 1.35;

  const SHAPE_KIND = {
    shell: 0,
    active: 1,
    emphasis: 2,
  };

  const SHAPE_DEFS = [
    { selector: ".top-nav", kind: SHAPE_KIND.shell, intensity: 0.35, radiusScale: 1.0 },
    { selector: ".hero", kind: SHAPE_KIND.emphasis, intensity: 0.28, radiusScale: 1.0 },
    { selector: ".home-services-card", kind: SHAPE_KIND.shell, intensity: 0.26, radiusScale: 1.0 },
    { selector: "#tabNav", kind: SHAPE_KIND.shell, intensity: 0.52, radiusScale: 1.0 },
    { selector: "#tabNav .tab-liquid-indicator", kind: SHAPE_KIND.active, intensity: 0.98, radiusScale: 1.0 },
    { selector: "#mobileDock", kind: SHAPE_KIND.shell, intensity: 0.62, radiusScale: 1.0 },
    { selector: "#mobileDockIndicator", kind: SHAPE_KIND.active, intensity: 1.14, radiusScale: 1.0 },
  ];

  const VERTEX_SHADER = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    precision mediump float;

    #define MAX_RECTS ${MAX_RECTS}

    uniform vec2 u_resolution;
    uniform float u_dpr;
    uniform float u_time;
    uniform vec2 u_pointer;
    uniform float u_count;
    uniform vec4 u_rects[MAX_RECTS];   // x, y, w, h in CSS px
    uniform vec4 u_styles[MAX_RECTS];  // radius, kind, intensity, reserved

    float sdRoundRect(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - (b - vec2(r));
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    vec3 drawGlassShape(vec2 cssPos, vec4 rect, vec4 style, vec2 pointerCss, inout float alphaOut) {
      float radius = style.x;
      float kind = style.y;
      float intensity = style.z;

      vec2 rectPos = rect.xy;
      vec2 rectSize = max(rect.zw, vec2(1.0));
      vec2 center = rectPos + rectSize * 0.5;
      vec2 halfSize = rectSize * 0.5;
      vec2 local = cssPos - center;

      float d = sdRoundRect(local, halfSize, radius);
      float aa = 1.25;
      float mask = 1.0 - smoothstep(0.0, aa, d);
      if (mask <= 0.001) {
        return vec3(0.0);
      }

      vec2 uv = clamp((cssPos - rectPos) / rectSize, 0.0, 1.0);
      float t = u_time;

      float edge = (1.0 - smoothstep(0.0, 2.0, abs(d)));
      float edgeGlow = (1.0 - smoothstep(1.5, 7.5, abs(d)));
      float innerFade = smoothstep(-12.0, -0.5, d);

      float topGloss = smoothstep(0.58, 0.02, uv.y) * (0.65 + 0.35 * smoothstep(0.0, 1.0, uv.x));
      float diagonalSpec = exp(-pow(uv.y - (0.18 + 0.06 * sin(t * 0.8 + uv.x * 7.0)), 2.0) / 0.0026);
      float waveA = sin((uv.x * 10.0 + uv.y * 6.0) + t * 1.25);
      float waveB = cos((uv.x * 6.0 - uv.y * 12.0) - t * 0.85 + kind * 0.7);
      float caustic = smoothstep(0.7, 1.0, 0.5 + 0.25 * waveA + 0.25 * waveB) * (0.35 + 0.65 * (1.0 - uv.y));

      vec2 pointerDelta = pointerCss - cssPos;
      float pointerDist = length(pointerDelta);
      float pointerGlow = exp(-pointerDist * 0.018);
      float pointerMask = mask * (0.25 + 0.75 * smoothstep(0.0, 1.0, intensity));

      float grain = (hash21(floor(cssPos * 0.5) + vec2(13.0, 29.0)) - 0.5) * 0.03;
      float shimmer = 0.5 + 0.5 * sin(t * 1.15 + uv.x * 14.0 + uv.y * 11.0);

      vec3 shellBase = vec3(0.15, 0.29, 0.48);
      vec3 shellCool = vec3(0.38, 0.64, 0.92);
      vec3 shellHot = vec3(0.88, 0.96, 1.0);
      vec3 activeBase = vec3(0.20, 0.40, 0.63);
      vec3 activeCool = vec3(0.51, 0.82, 1.0);
      vec3 activeHot = vec3(0.97, 0.995, 1.0);
      vec3 emphBase = vec3(0.12, 0.25, 0.40);
      vec3 emphCool = vec3(0.30, 0.55, 0.84);
      vec3 emphHot = vec3(0.84, 0.95, 1.0);

      vec3 baseColor = shellBase;
      vec3 coolColor = shellCool;
      vec3 hotColor = shellHot;
      if (kind > 0.5 && kind < 1.5) {
        baseColor = activeBase;
        coolColor = activeCool;
        hotColor = activeHot;
      } else if (kind >= 1.5) {
        baseColor = emphBase;
        coolColor = emphCool;
        hotColor = emphHot;
      }

      float activeBoost = kind > 0.5 && kind < 1.5 ? 1.0 : 0.0;
      float shellBoost = kind < 0.5 ? 1.0 : 0.0;
      float emphBoost = kind >= 1.5 ? 1.0 : 0.0;

      vec3 color = baseColor * (0.06 + 0.14 * innerFade);
      color += coolColor * (0.05 + 0.20 * topGloss + 0.10 * caustic) * intensity;
      color += hotColor * (0.05 * edge + 0.07 * diagonalSpec + 0.05 * shimmer * innerFade) * (0.75 + intensity * 0.4);
      color += vec3(0.56, 0.81, 1.0) * edgeGlow * (0.02 + 0.06 * intensity + 0.05 * activeBoost);
      color += vec3(0.95, 0.98, 1.0) * pointerGlow * pointerMask * (0.02 + 0.08 * activeBoost + 0.03 * emphBoost);
      color += vec3(grain);

      float alpha = mask * (0.028 + 0.05 * shellBoost + 0.11 * activeBoost + 0.04 * emphBoost) * (0.45 + intensity * 0.75);
      alpha += edge * (0.02 + 0.05 * intensity);
      alpha += diagonalSpec * 0.015 * (0.5 + activeBoost);
      alpha = clamp(alpha, 0.0, 0.42 + activeBoost * 0.26);

      alphaOut = alpha;
      return color;
    }

    void main() {
      vec2 fragPx = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
      vec2 cssPos = fragPx / max(u_dpr, 0.0001);
      vec2 pointerCss = u_pointer;

      vec3 outColor = vec3(0.0);
      float outAlpha = 0.0;

      for (int i = 0; i < MAX_RECTS; i++) {
        if (float(i) >= u_count) {
          break;
        }
        float alphaShape = 0.0;
        vec3 colorShape = drawGlassShape(cssPos, u_rects[i], u_styles[i], pointerCss, alphaShape);
        outColor += colorShape * alphaShape;
        outAlpha = clamp(outAlpha + alphaShape * (1.0 - outAlpha), 0.0, 1.0);
      }

      gl_FragColor = vec4(outColor, outAlpha);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("shader allocation failed");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "shader compile failed";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program) {
      throw new Error("program allocation failed");
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || "program link failed";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function parsePx(value, fallback) {
    const n = Number.parseFloat(String(value || ""));
    return Number.isFinite(n) ? n : fallback;
  }

  function getRadiusPx(element, rect) {
    if (!element || !rect) {
      return 12;
    }
    const style = window.getComputedStyle(element);
    const radiusRaw = style.borderTopLeftRadius || style.borderRadius || "12px";
    const radius = parsePx(radiusRaw, 12);
    const maxRadius = Math.max(2, Math.min(rect.width, rect.height) * 0.5);
    return Math.min(Math.max(radius, 2), maxRadius);
  }

  function isRectVisible(rect) {
    if (!rect || rect.width < 1 || rect.height < 1) {
      return false;
    }
    if (rect.bottom < -4 || rect.top > window.innerHeight + 4) {
      return false;
    }
    if (rect.right < -4 || rect.left > window.innerWidth + 4) {
      return false;
    }
    return true;
  }

  function isElementActuallyVisible(element) {
    if (!element || element.hidden) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }
    return true;
  }

  function createCanvas() {
    const canvas = document.createElement("canvas");
    canvas.className = "liquid-glass-overlay-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = 1;
    canvas.height = 1;
    return canvas;
  }

  function init() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.body.classList.add("liquid-glass-engine-reduced");
    }

    const canvas = createCanvas();
    document.body.appendChild(canvas);

    const gl =
      canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
      }) || null;

    if (!gl) {
      document.body.classList.add("liquid-glass-engine-fallback");
      canvas.remove();
      return;
    }

    let program;
    try {
      program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    } catch (error) {
      console.error("[liquid-glass] shader init failed", error);
      document.body.classList.add("liquid-glass-engine-fallback");
      canvas.remove();
      return;
    }

    const rects = new Float32Array(MAX_RECTS * 4);
    const styles = new Float32Array(MAX_RECTS * 4);
    let pointerX = -10000;
    let pointerY = -10000;
    let viewportWidthCss = window.innerWidth;
    let viewportHeightCss = window.innerHeight;
    let dpr = 1;
    let running = true;
    let lastFrameTs = 0;

    const locations = {
      position: gl.getAttribLocation(program, "a_position"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      dpr: gl.getUniformLocation(program, "u_dpr"),
      time: gl.getUniformLocation(program, "u_time"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      count: gl.getUniformLocation(program, "u_count"),
      rects: gl.getUniformLocation(program, "u_rects[0]"),
      styles: gl.getUniformLocation(program, "u_styles[0]"),
    };

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         3, -1,
        -1,  3,
      ]),
      gl.STATIC_DRAW
    );

    gl.useProgram(program);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function resizeCanvas() {
      viewportWidthCss = window.innerWidth;
      viewportHeightCss = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.max(1, Math.round(viewportWidthCss * dpr));
      canvas.height = Math.max(1, Math.round(viewportHeightCss * dpr));
      canvas.style.width = `${viewportWidthCss}px`;
      canvas.style.height = `${viewportHeightCss}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function collectShapes() {
      let count = 0;
      for (const def of SHAPE_DEFS) {
        if (count >= MAX_RECTS) {
          break;
        }
        const element = document.querySelector(def.selector);
        if (!element || !isElementActuallyVisible(element)) {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (!isRectVisible(rect)) {
          continue;
        }
        const radius = getRadiusPx(element, rect) * (def.radiusScale || 1);
        const base = count * 4;
        rects[base + 0] = rect.left;
        rects[base + 1] = rect.top;
        rects[base + 2] = rect.width;
        rects[base + 3] = rect.height;
        styles[base + 0] = radius;
        styles[base + 1] = def.kind;
        styles[base + 2] = def.intensity;
        styles[base + 3] = 0;
        count += 1;
      }
      return count;
    }

    function draw(ts) {
      if (!running) {
        return;
      }
      window.requestAnimationFrame(draw);

      if (document.hidden) {
        return;
      }
      if (ts - lastFrameTs < FRAME_MS) {
        return;
      }
      lastFrameTs = ts;

      const shapeCount = collectShapes();
      if (shapeCount === 0) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }

      gl.useProgram(program);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(locations.resolution, canvas.width, canvas.height);
      gl.uniform1f(locations.dpr, dpr);
      gl.uniform1f(locations.time, ts * 0.001);
      gl.uniform2f(locations.pointer, pointerX, pointerY);
      gl.uniform1f(locations.count, shapeCount);
      gl.uniform4fv(locations.rects, rects);
      gl.uniform4fv(locations.styles, styles);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function onPointerMove(event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }

    function clearPointer() {
      pointerX = -10000;
      pointerY = -10000;
    }

    resizeCanvas();
    document.body.classList.add("liquid-glass-engine-ready");

    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.addEventListener("orientationchange", resizeCanvas, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", clearPointer, { passive: true });
    window.addEventListener("pointercancel", clearPointer, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        lastFrameTs = 0;
      }
    });

    window.requestAnimationFrame(draw);

    window.LiquidGlassEngine = {
      refresh: resizeCanvas,
      destroy() {
        running = false;
        try {
          gl.deleteProgram(program);
          gl.deleteBuffer(vertexBuffer);
        } catch (_error) {
          // ignore cleanup failures
        }
        canvas.remove();
        delete window.LiquidGlassEngine;
      },
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      init();
    } catch (error) {
      console.error("[liquid-glass] init failed", error);
    }
  });
})();
