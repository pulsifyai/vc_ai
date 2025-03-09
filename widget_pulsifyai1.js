class PulsifyAIWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Create and initialize the Eleven Labs widget first
    const widget = document.createElement('elevenlabs-convai');
    
    // Copy attributes
    Array.from(this.attributes).forEach(attr => {
      if (attr.name !== 'class' && attr.name !== 'style') {
        widget.setAttribute(attr.name, attr.value);
      }
    });
    
    // Add custom styles
    const styles = document.createElement('style');
    styles.textContent = this.getCustomStyles();
    
    // Append elements to shadow DOM
    this.shadowRoot.appendChild(styles);
    this.shadowRoot.appendChild(widget);
    
    // Observe when the widget is loaded and replace the orb
    this.setupOrbReplacement();
  }

  getCustomStyles() {
    return `
      :host {
        display: contents;
      }
    `;
  }

  setupOrbReplacement() {
    // Create a new MutationObserver to watch for the widget's initialization
    const observer = new MutationObserver(mutations => {
      const elevenlabsWidget = this.shadowRoot.querySelector('elevenlabs-convai');
      if (!elevenlabsWidget || !elevenlabsWidget.shadowRoot) return;
      
      // Check if the avatar container exists
      const avatarContainer = elevenlabsWidget.shadowRoot.querySelector('._avatarImage_me40k_102');
      if (avatarContainer) {
        // Stop observing since we found what we need
        observer.disconnect();
        
        // Replace the avatar with our custom animation
        this.replaceOrb(elevenlabsWidget.shadowRoot, avatarContainer);
      }
    });
    
    // Start observing
    observer.observe(this.shadowRoot, { childList: true, subtree: true });
  }

  replaceOrb(shadowRoot, avatarContainer) {
    // Clear the existing background
    avatarContainer.style.backgroundImage = 'none';
    avatarContainer.style.backgroundColor = 'transparent';
    
    // Create our custom animation element
    const customOrb = document.createElement('div');
    customOrb.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
    `;
    
    // Add a new canvas element for our animation
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
    `;
    
    customOrb.appendChild(canvas);
    avatarContainer.appendChild(customOrb);
    
    // Initialize the animation
    this.initPulsifyAnimation(canvas, shadowRoot);
  }

  initPulsifyAnimation(canvas, shadowRoot) {
    // Set up canvas
    const ctx = canvas.getContext('2d');
    const audioAnalyzer = new PulsifyAudioAnalyzer(shadowRoot);
    
    // Set initial dimensions
    const setCanvasDimensions = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    
    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);
    
    // Animation properties
    let animationFrame;
    let time = 0;
    
    // Animation function
    const animate = () => {
      const amplitude = audioAnalyzer.getAmplitude();
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Draw background
      const gradientBg = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradientBg.addColorStop(0, 'rgba(30, 60, 120, 0.2)');
      gradientBg.addColorStop(1, 'rgba(0, 20, 80, 0.1)');
      
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, 0, width, height);
      
      // Draw the equalizer effect
      this.drawEqualizerOrb(ctx, centerX, centerY, radius, time, amplitude);
      
      // Update time
      time += 0.02;
      
      // Continue animation
      animationFrame = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Clean up on disconnect
    this.addEventListener('disconnectedCallback', () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', setCanvasDimensions);
    });
  }
  
  drawEqualizerOrb(ctx, centerX, centerY, radius, time, amplitude) {
    // Number of segments in the equalizer
    const segments = 120;
    const baseRadius = radius * 0.85;
    
    // Draw outer glow
    const glowSize = radius * 0.15 * amplitude;
    const glow = ctx.createRadialGradient(
      centerX, centerY, baseRadius - glowSize,
      centerX, centerY, baseRadius + glowSize * 2
    );
    glow.addColorStop(0, 'rgba(80, 160, 255, 0.4)');
    glow.addColorStop(0.5, 'rgba(80, 160, 255, 0.1)');
    glow.addColorStop(1, 'rgba(80, 160, 255, 0)');
    
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius + glowSize * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw the equalizer segments
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(150, 210, 255, 0.8)';
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const noiseVal = this.noise(Math.cos(angle) + time, Math.sin(angle) + time);
      const radiusOffset = radius * 0.15 * (0.5 + amplitude) * noiseVal;
      
      const x1 = centerX + Math.cos(angle) * (baseRadius - radiusOffset * 0.5);
      const y1 = centerY + Math.sin(angle) * (baseRadius - radiusOffset * 0.5);
      const x2 = centerX + Math.cos(angle) * (baseRadius + radiusOffset);
      const y2 = centerY + Math.sin(angle) * (baseRadius + radiusOffset);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      
      // Add small particles for extra effect
      if (i % 4 === 0 && amplitude > 0.6) {
        const particleRadius = Math.random() * 2 * amplitude;
        const distance = baseRadius + radiusOffset + Math.random() * 10 * amplitude;
        const px = centerX + Math.cos(angle) * distance;
        const py = centerY + Math.sin(angle) * distance;
        
        ctx.fillStyle = 'rgba(180, 220, 255, ' + (0.7 * amplitude) + ')';
        ctx.beginPath();
        ctx.arc(px, py, particleRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw concentric circles
    const numCircles = 3;
    for (let i = 0; i < numCircles; i++) {
      const circleRadius = baseRadius * (0.4 + (i * 0.2));
      const opacity = 0.2 - (i * 0.05);
      
      ctx.strokeStyle = `rgba(100, 180, 255, ${opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw center
    const innerGlow = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, baseRadius * 0.4
    );
    innerGlow.addColorStop(0, 'rgba(200, 230, 255, 0.2)');
    innerGlow.addColorStop(1, 'rgba(80, 160, 255, 0)');
    
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Simple 2D noise function
  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.p[X] + Y;
    const B = this.p[X + 1] + Y;
    
    return this.lerp(v, 
      this.lerp(u, 
        this.grad(this.p[A], x, y), 
        this.grad(this.p[B], x - 1, y)
      ),
      this.lerp(u,
        this.grad(this.p[A + 1], x, y - 1),
        this.grad(this.p[B + 1], x - 1, y - 1)
      )
    );
  }
  
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  
  lerp(t, a, b) { return a + t * (b - a); }
  
  grad(hash, x, y) {
    const h = hash & 15;
    const grad_x = 1 + (h & 7);
    const grad_y = grad_x & 1 ? 1 : -1;
    return (grad_x & 2 ? grad_y : 0) * x + (grad_x & 4 ? grad_y : 0) * y;
  }
  
  // Initialize Perlin noise
  get p() {
    if (!this._p) {
      const permutation = Array.from({length: 256}, (_, i) => i);
      
      // Fisher-Yates shuffle
      for (let i = permutation.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
      }
      
      this._p = new Array(512);
      for (let i = 0; i < 256; i++) {
        this._p[i] = this._p[i + 256] = permutation[i];
      }
    }
    return this._p;
  }
}

class PulsifyAudioAnalyzer {
  constructor(shadowRoot) {
    this.shadowRoot = shadowRoot;
    this.amplitude = 0.5;
    this.targetAmplitude = 0.5;
    this.lastCheck = Date.now();
    
    // Start monitoring
    this.monitor();
  }
  
  monitor() {
    setInterval(() => {
      // Check for speaking indicators in the widget
      const isSpeaking = !!this.shadowRoot.querySelector('._status_me40k_146');
      const statusText = isSpeaking ? 
        this.shadowRoot.querySelector('._status_me40k_146').textContent : '';
      
      // Determine if speaking or listening
      const isActive = statusText.includes('Speaking') || statusText.includes('Listening');
      
      // Adjust amplitude target based on status
      if (isActive) {
        // More energetic when speaking
        this.targetAmplitude = statusText.includes('Speaking') ? 
          0.7 + Math.random() * 0.3 : // Speaking 
          0.5 + Math.random() * 0.2;  // Listening
      } else {
        // Calmer when idle
        this.targetAmplitude = 0.4 + Math.random() * 0.1;
      }
      
      // Smoothly adjust current amplitude toward target
      const delta = this.targetAmplitude - this.amplitude;
      this.amplitude += delta * 0.1;
      
      // Add some subtle variation
      this.amplitude += (Math.random() - 0.5) * 0.05;
      
      // Keep within bounds
      this.amplitude = Math.max(0.3, Math.min(1.0, this.amplitude));
    }, 100);
  }
  
  getAmplitude() {
    return this.amplitude;
  }
}

// Register the custom element
customElements.define('pulsify-ai-widget', PulsifyAIWidget);
