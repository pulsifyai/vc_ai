class PulsifyAIWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Clone the original Eleven Labs widget
    const widget = document.createElement('elevenlabs-convai');
    
    // Copy attributes from our custom element to the widget
    Array.from(this.attributes).forEach(attr => {
      if (attr.name !== 'class' && attr.name !== 'style') {
        widget.setAttribute(attr.name, attr.value);
      }
    });
    
    // Add our custom styles
    const styles = document.createElement('style');
    styles.textContent = this.getCustomStyles();
    
    // Append elements to shadow DOM
    this.shadowRoot.appendChild(styles);
    this.shadowRoot.appendChild(widget);
    
    // Replace the default orb with our custom animation
    this.injectCustomAnimation();
  }

  getCustomStyles() {
    return `
      :host {
        --el-bg-color: #040619;
        --el-text-color: #ffffff;
        --el-border-color: rgba(56, 147, 232, 0.4);
        --el-btn-color: #3893e8;
        --el-btn-text-color: #ffffff;
        --el-btn-radius: 8px;
        --el-border-radius: 12px;
        --el-focus-color: #3893e8;
        --el-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
      }
    `;
  }

  injectCustomAnimation() {
    // Wait for the widget to initialize
    setTimeout(() => {
      const shadowRoot = this.shadowRoot.querySelector('elevenlabs-convai').shadowRoot;
      if (!shadowRoot) return;
      
      // Find the canvas element
      const canvas = shadowRoot.querySelector('._canvas_me40k_114');
      if (!canvas) return;
      
      // Initialize our custom WebGL animation
      this.initPulsifyAnimation(canvas, shadowRoot);
      
      // Override the default animation by replacing the canvas parent's innerHTML
      const avatarImage = shadowRoot.querySelector('._avatarImage_me40k_102');
      if (avatarImage) {
        avatarImage.style.backgroundColor = '#040619';
      }
    }, 1000);
  }

  initPulsifyAnimation(canvas, shadowRoot) {
    // Get WebGL context
    const gl = canvas.getContext('webgl2');
    if (!gl) return;
    
    // Set up our custom animation
    const pulsifyAnimation = new PulsifyOrb(gl, shadowRoot);
    pulsifyAnimation.init();
    
    // Start the animation loop
    const animate = () => {
      pulsifyAnimation.render();
      requestAnimationFrame(animate);
    };
    
    animate();
  }
}

class PulsifyOrb {
  constructor(gl, shadowRoot) {
    this.gl = gl;
    this.shadowRoot = shadowRoot;
    this.time = 0;
    this.vertexShader = null;
    this.fragmentShader = null;
    this.program = null;
    this.positionBuffer = null;
    this.indexBuffer = null;
    this.uniforms = {};
    this.amplitude = 0.5; // Voice reactivity amplitude
    
    // Audio monitoring setup
    this.setupAudioMonitoring();
  }
  
  setupAudioMonitoring() {
    // Check for existing audio indicators in the widget
    setInterval(() => {
      // Find speaking status by checking for certain CSS classes or elements
      const isSpeaking = !!this.shadowRoot.querySelector('._btn_me40k_160');
      
      // Get any frequency data from the widget if available
      const frequencyData = this.shadowRoot.querySelector('.getInputByteFrequencyData, .getOutputByteFrequencyData');
      
      // Use the data to adjust our animation
      if (isSpeaking) {
        // When speaking, increase amplitude
        this.amplitude = Math.min(2.0, this.amplitude + 0.05);
      } else {
        // When not speaking, gradually decrease
        this.amplitude = Math.max(0.5, this.amplitude - 0.02);
      }
    }, 100);
  }

  init() {
    const gl = this.gl;
    
    // Create shader program
    this.vertexShader = this.createShader(gl.VERTEX_SHADER, this.getVertexShaderSource());
    this.fragmentShader = this.createShader(gl.FRAGMENT_SHADER, this.getFragmentShaderSource());
    this.program = this.createProgram();
    
    // Create sphere geometry
    this.createSphereGeometry();
    
    // Set up uniforms
    this.setupUniforms();
    
    // Set initial GL state
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  createProgram() {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, this.vertexShader);
    gl.attachShader(program, this.fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }

  createSphereGeometry() {
    const gl = this.gl;
    
    // Create a detailed sphere
    const radius = 1.0;
    const latitudeBands = 64;
    const longitudeBands = 64;
    
    const positions = [];
    const indices = [];
    
    // Generate vertices
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = lat * Math.PI / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      
      for (let lon = 0; lon <= longitudeBands; lon++) {
        const phi = lon * 2 * Math.PI / longitudeBands;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        
        positions.push(x * radius, y * radius, z * radius);
      }
    }
    
    // Generate indices
    for (let lat = 0; lat < latitudeBands; lat++) {
      for (let lon = 0; lon < longitudeBands; lon++) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        
        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }
    
    // Create position buffer
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // Create index buffer
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    this.indexCount = indices.length;
  }

  setupUniforms() {
    const gl = this.gl;
    
    this.uniforms = {
      uTime: gl.getUniformLocation(this.program, 'uTime'),
      uAmplitude: gl.getUniformLocation(this.program, 'uAmplitude'),
      uColor1: gl.getUniformLocation(this.program, 'uColor1'),
      uColor2: gl.getUniformLocation(this.program, 'uColor2')
    };
  }

  render() {
    const gl = this.gl;
    
    // Update canvas size to match container
    this.updateCanvasSize();
    
    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Use our shader program
    gl.useProgram(this.program);
    
    // Update time uniform
    this.time += 0.01;
    gl.uniform1f(this.uniforms.uTime, this.time);
    
    // Update amplitude uniform (voice reactivity)
    gl.uniform1f(this.uniforms.uAmplitude, this.amplitude);
    
    // Set colors
    gl.uniform3f(this.uniforms.uColor1, 0.15, 0.57, 0.91); // Primary blue
    gl.uniform3f(this.uniforms.uColor2, 0.61, 0.87, 0.93); // Light blue
    
    // Set up position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const positionLoc = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    
    // Draw the sphere
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  updateCanvasSize() {
    const canvas = this.gl.canvas;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      this.gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  getVertexShaderSource() {
    return `#version 300 es
      precision highp float;
      
      in vec3 position;
      
      uniform float uTime;
      uniform float uAmplitude;
      
      out vec3 vPosition;
      out vec3 vNormal;
      
      // Noise functions from https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        // First corner
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        // Permutations
        i = mod289(i);
        vec4 p = permute(permute(permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                   
        // Gradients
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        // Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      
      void main() {
        // Calculate a dynamic displacement based on noise
        float speed = 0.2;
        float noiseScale = 2.0;
        float displacementScale = 0.2 * uAmplitude;
        
        // Use 3D Perlin noise for displacement
        float noise1 = snoise(position * noiseScale + vec3(uTime * speed));
        float noise2 = snoise(position * noiseScale * 2.0 + vec3(uTime * speed * 1.5 + 30.0));
        
        // Layer the noise for more complex effects
        float displacement = noise1 * 0.7 + noise2 * 0.3;
        
        // Apply displacement along normal
        vec3 displacedPosition = position * (1.0 + displacement * displacementScale);
        
        // Calculate normal - could use a proper normal calculation for better lighting
        vNormal = normalize(displacedPosition);
        
        // Pass position to fragment shader
        vPosition = displacedPosition;
        
        // Output position
        gl_Position = vec4(displacedPosition, 1.0);
      }
    `;
  }

  getFragmentShaderSource() {
    return `#version 300 es
      precision highp float;
      
      in vec3 vPosition;
      in vec3 vNormal;
      
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      
      out vec4 fragColor;
      
      // Random function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      // Simplified fresnel effect
      float fresnel(vec3 normal, vec3 viewDir, float power) {
        return pow(1.0 - abs(dot(normalize(normal), normalize(viewDir))), power);
      }
      
      void main() {
        // Calculate view direction (assuming camera at origin)
        vec3 viewDir = normalize(-vPosition);
        
        // Calculate fresnel effect for edge glow
        float fresnelFactor = fresnel(vNormal, viewDir, 2.0);
        
        // Create wave pattern
        float wavePattern = sin(40.0 * vPosition.y + uTime) * 0.5 + 0.5;
        wavePattern *= sin(40.0 * vPosition.x + uTime * 0.7) * 0.5 + 0.5;
        
        // Create line pattern
        float linePattern = abs(fract(20.0 * vPosition.y - uTime * 0.1) - 0.5);
        linePattern = smoothstep(0.45, 0.5, linePattern);
        
        // Generate small dots
        vec2 dotPos = fract(vPosition.xy * 30.0);
        float dotPattern = step(0.9, random(floor(vPosition.xy * 30.0)));
        dotPattern *= step(0.4, length(dotPos - 0.5));
        
        // Combine patterns
        float pattern = max(linePattern * 0.7, dotPattern * 0.3);
        pattern = max(pattern, wavePattern * 0.15);
        
        // Final color mix
        vec3 baseColor = mix(uColor1, uColor2, fresnelFactor);
        vec3 patternColor = mix(baseColor, vec3(1.0), pattern * 0.8);
        
        // Add glow at edges
        vec3 finalColor = mix(patternColor, vec3(1.0), fresnelFactor * 0.7);
        
        // Set opacity based on fresnel and pattern
        float alpha = mix(0.1, 0.95, fresnelFactor + pattern * 0.5);
        
        fragColor = vec4(finalColor, alpha);
      }
    `;
  }
}

// Register the custom element
customElements.define('pulsify-ai-widget', PulsifyAIWidget);
