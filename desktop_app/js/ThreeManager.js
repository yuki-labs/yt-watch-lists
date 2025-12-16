import * as THREE from './libs/three.module.js';

export class ThreeManager {
    constructor() {
        this.enabled = false;
        this.elements = new Map(); // DOM Element -> Mesh
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.init();
    }

    init() {
        console.log("THREE MANAGER VERSION: BACKGROUND COLOR FIX - LOADED");
        // 1. Create Canvas Container
        this.canvasCallback = document.createElement('canvas');
        this.canvasCallback.id = 'three-bg';
        this.canvasCallback.style.position = 'fixed';
        this.canvasCallback.style.top = '0';
        this.canvasCallback.style.left = '0';
        this.canvasCallback.style.width = '100%';
        this.canvasCallback.style.height = '100%';
        this.canvasCallback.style.zIndex = '-1'; // Behind everything
        this.canvasCallback.style.pointerEvents = 'none'; // Pass through clicks to HTML
        this.canvasCallback.style.opacity = '0';
        this.canvasCallback.style.transition = 'opacity 0.5s';
        document.body.prepend(this.canvasCallback);

        // 2. Setup Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe0e5ec);

        // Orthographic Camera for 1:1 pixel mapping
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
        this.camera.position.z = 500;
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvasCallback, alpha: false, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 3. Lighting
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); // Boost to 2.0
        dirLight.position.set(-500, 500, 500); // Standard Top-Left
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 2000;
        // Tune shadow camera for screen size coverage
        dirLight.shadow.camera.left = -width;
        dirLight.shadow.camera.right = width;
        dirLight.shadow.camera.top = height;
        dirLight.shadow.camera.bottom = -height;
        dirLight.shadow.bias = -0.0001; // Less aggressive bias to fix black borders
        dirLight.shadow.normalBias = 0.02; // Use normal bias for smooth curved surfaces
        dirLight.shadow.radius = 4;
        this.scene.add(dirLight);

        // FILL LIGHT (Softens the dark side shadows so they aren't pitch black)
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(500, -500, 500); // Bottom-Right
        this.scene.add(fillLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.95); // High Ambient to match background flat color
        this.scene.add(ambientLight);

        // 4. Resize Handler
        window.addEventListener('resize', () => this.onResize());

        // 5. Scroll Handler (Sync positions)
        window.addEventListener('scroll', () => this.sync(), true); // Capture phase/true for all scrolling elements?

        // 6. Animation Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    enable() {
        this.enabled = true;
        this.canvasCallback.style.opacity = '1';
        this.scan();
    }

    disable() {
        this.enabled = false;
        this.canvasCallback.style.opacity = '0';
    }

    // Scan DOM for elements to replicate
    scan() {
        if (!this.enabled) return;

        // Select logic: Buttons and Cards that are visible
        const query = '.video-item, .primary-btn, .menu-btn, .theme-toggle, input[type="text"], #add-btn, #select-file-btn, #download-thumbs-btn';
        const domElements = document.querySelectorAll(query);

        // Mark current elements
        const currentSet = new Set();

        domElements.forEach(el => {
            currentSet.add(el);
            if (!this.elements.has(el)) {
                this.createMesh(el);
            }
        });

        // Cleanup removed elements
        for (const [el, mesh] of this.elements) {
            if (!currentSet.has(el)) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                this.elements.delete(el);
            }
        }

        this.sync();
    }

    // Helper: Generate points for a rounded rectangle
    getRoundedRectPoints(w, h, r, segments) {
        const pts = [];
        const halfW = w / 2;
        const halfH = h / 2;

        // Top Right
        for (let i = 0; i <= segments; i++) {
            const theta = (Math.PI / 2) * (1 - i / segments);
            const x = halfW - r + r * Math.cos(theta);
            const y = halfH - r + r * Math.sin(theta);
            pts.push(new THREE.Vector2(x, y));
        }
        // Bottom Right
        for (let i = 0; i <= segments; i++) {
            const theta = (Math.PI / 2) * (0 - i / segments);
            const x = halfW - r + r * Math.cos(theta);
            const y = -halfH + r + r * Math.sin(theta);
            pts.push(new THREE.Vector2(x, y));
        }
        // Bottom Left
        for (let i = 0; i <= segments; i++) {
            const theta = (Math.PI / 2) * (-1 - i / segments);
            const x = -halfW + r + r * Math.cos(theta);
            const y = -halfH + r + r * Math.sin(theta);
            pts.push(new THREE.Vector2(x, y));
        }
        // Top Left
        for (let i = 0; i <= segments; i++) {
            const theta = (Math.PI / 2) * (-2 - i / segments);
            const x = -halfW + r + r * Math.cos(theta);
            const y = halfH - r + r * Math.sin(theta);
            pts.push(new THREE.Vector2(x, y));
        }
        return pts.reverse();
    }

    createConcaveGeometry(width, height, radius, bevelSize, bevelHeight, bevelSegments) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const uvs = [];
        const normals = [];

        const numRings = bevelSegments + 1;
        const ringPoints = [];

        // 1. Generate Profile Rings (Skirt)
        for (let r = 0; r <= bevelSegments; r++) {
            const t = r / bevelSegments;
            // Concave Expansion: Starts slow, speeds up.
            // CONCAVE PROFILE FIX (Inverted Curve):
            // Use t^4 to start vertical (top) and flare horizontal (bottom).
            // Multiplier 0.6 reduces the total flare width ("flare less").
            const expansion = (bevelSize * 0.6) * Math.pow(t, 4);
            const z = bevelHeight * (1 - t);

            const currentW = width + 2 * expansion;
            const currentH = height + 2 * expansion;
            const currentR = radius + expansion;

            const shapePts = this.getRoundedRectPoints(currentW, currentH, currentR, 8); // 8 segs per corner

            const ringStart = vertices.length / 3;
            const ringIndices = [];

            for (let i = 0; i < shapePts.length; i++) {
                const p = shapePts[i];
                vertices.push(p.x, p.y, z);
                ringIndices.push(ringStart + i);

                // UVs: Simple planar projection
                uvs.push((p.x / currentW) + 0.5, (p.y / currentH) + 0.5);

                // Normals
                normals.push(0, 0, 1);
            }
            ringPoints.push(ringIndices);
        }

        // 2. Build Faces (Skirt)
        const ptsPerRing = ringPoints[0].length;
        for (let r = 0; r < bevelSegments; r++) {
            const currentRing = ringPoints[r];
            const nextRing = ringPoints[r + 1];

            for (let i = 0; i < ptsPerRing; i++) {
                const nextI = (i + 1) % ptsPerRing;
                const a = currentRing[i];
                const b = nextRing[i];
                const c = nextRing[nextI];
                const d = currentRing[nextI];

                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        // 3. Lid (Top Face) - SEPARATE VERTICES FOR SHARP EDGE
        // We duplicate the top ring vertices so normals are not shared with the skirt.
        // Skirt top normal = diagonal/horizontal. Lid normal = strict up (0,0,1).

        // 3a. Create Lid Perimeter Ring
        const lidRingStart = vertices.length / 3;
        const lidIndices = [];
        // Re-generate top ring points (t=0)
        const topShapePts = this.getRoundedRectPoints(width, height, radius, 8);

        for (let i = 0; i < topShapePts.length; i++) {
            const p = topShapePts[i];
            vertices.push(p.x, p.y, bevelHeight);
            lidIndices.push(lidRingStart + i);
            uvs.push((p.x / width) + 0.5, (p.y / height) + 0.5);
            normals.push(0, 0, 1); // Explicit Up
        }

        // 3b. Lid Center
        vertices.push(0, 0, bevelHeight);
        normals.push(0, 0, 1);
        uvs.push(0.5, 0.5);
        const topCenterIdx = (vertices.length / 3) - 1;

        // 3c. Triangulate Lid
        for (let i = 0; i < lidIndices.length; i++) {
            const nextI = (i + 1) % lidIndices.length;
            indices.push(lidIndices[i], lidIndices[nextI], topCenterIdx);
        }

        // 4. Floor (Bottom Face) - REMOVED
        // We don't need the bottom face as it faces away from camera and light,
        // and can cause "black line" artifacts at the perimeter due to AA bleeding.
        /*
        vertices.push(0, 0, 0);
        normals.push(0, 0, -1);
        uvs.push(0.5, 0.5);
        const botCenterIdx = (vertices.length / 3) - 1;

        const botRing = ringPoints[bevelSegments];
        for (let i = 0; i < ptsPerRing; i++) {
            const nextI = (i + 1) % ptsPerRing;
            indices.push(botRing[nextI], botRing[i], botCenterIdx);
        }
        */

        geometry.setIndex(indices);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.computeVertexNormals();

        return geometry;
    }

    createMesh(el) {
        // Default Material
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xe0e5ec,
            roughness: 0.2, // Slightly rougher to diffuse light
            metalness: 0.0, // No metalness to prevent darkening
            clearcoat: 0.3, // Reduced clearcoat to avoid dark reflections
            clearcoatRoughness: 0.1,
        });

        const rect = el.getBoundingClientRect();
        let radius = parseFloat(window.getComputedStyle(el).borderRadius) || 12;

        // CLAMP RADIUS to prevent geometry inversion (e.g. circle logic)
        // If radius > half dimension, corners cross over.
        const maxR = Math.min(rect.width / 2, rect.height / 2);
        if (radius > maxR) radius = maxR;

        // Custom Geometry Params
        let bevelSize = 15;
        let bevelHeight = 10;
        const bevelSegments = 10;

        // Tune params for small elements (like Toggle) to prevent overlap
        if (el.classList.contains('theme-toggle') || el.classList.contains('menu-btn')) {
            bevelSize = 6;
            bevelHeight = 6;
        }

        const geometry = this.createConcaveGeometry(rect.width, rect.height, radius, bevelSize, bevelHeight, bevelSegments);

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.elements.set(el, mesh);

        // Store initial settings
        mesh.userData.lastRect = { width: rect.width, height: rect.height, radius: radius };

        // Initial Color Set
        // Standard Neumorphic = Match Background (0xe0e5ec)
        let colorHex = 0xe0e5ec;
        if (el.classList.contains('theme-toggle')) {
            colorHex = 0xffe082; // Keep toggle distinct (Sun/Moon)
        }
        mesh.material.color.setHex(colorHex);
    }

    sync() {
        if (!this.enabled) return;

        const widthHalf = window.innerWidth / 2;
        const heightHalf = window.innerHeight / 2;

        for (const [el, mesh] of this.elements) {
            const rect = el.getBoundingClientRect();
            // Check visibility
            if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(el).display === 'none') {
                mesh.visible = false;
                continue;
            }
            mesh.visible = true;

            let radius = parseFloat(window.getComputedStyle(el).borderRadius) || 12;
            const maxR = Math.min(rect.width / 2, rect.height / 2);
            if (radius > maxR) radius = maxR;

            // Determine params again for regeneration check/creation
            let bevelSize = 15;
            let bevelHeight = 10;
            if (el.classList.contains('theme-toggle') || el.classList.contains('menu-btn')) {
                bevelSize = 6;
                bevelHeight = 6;
            }

            // Recreate geometry if dimensions change
            if (!mesh.userData.lastRect ||
                mesh.userData.lastRect.width !== rect.width.toFixed(2) ||
                mesh.userData.lastRect.height !== rect.height ||
                mesh.userData.lastRect.radius !== radius) {
                mesh.geometry.dispose();
                mesh.geometry = this.createConcaveGeometry(rect.width, rect.height, radius, bevelSize, bevelHeight, 10);
                mesh.userData.lastRect = { width: rect.width, height: rect.height, radius: radius };
            }

            // Position: Center of rect converted to Three coords
            const x = rect.left + rect.width / 2 - widthHalf;
            const y = -(rect.top + rect.height / 2 - heightHalf);

            mesh.position.set(x, y, 0);

            // Special handling for "Pressed" state (Active)
            if (el.matches(':active')) {
                mesh.position.z = -5; // Push in
            } else {
                mesh.position.z = 0;
            }

            // Colors overrides (Ensure they stay set)
            // Colors overrides (Ensure they stay set)
            // Standard Neumorphic = Match Background (0xe0e5ec)
            let colorHex = 0xe0e5ec;
            if (el.classList.contains('theme-toggle')) {
                colorHex = 0xffe082; // Keep toggle distinct (Sun/Moon)
            }
            mesh.material.color.setHex(colorHex);
        }
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.left = width / -2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = height / -2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.sync();
    }

    animate() {
        requestAnimationFrame(this.animate);
        if (this.enabled) {
            // Continuous sync for smooth scrolling/drag
            this.sync();
            this.renderer.render(this.scene, this.camera);
        }
    }
}
