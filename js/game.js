// Zen Stack 3D - Full 3D Physics Engine & ASMR Slicing Mechanics

class ZenStackGame {
    constructor() {
        this.saveData = window.storageManager.load();
        this.score = 0;
        this.highScore = this.saveData.highScore || 0;
        this.combo = 0;
        this.isPlaying = false;
        this.isGameOver = false;

        // Current stack dimensions & state
        this.stack = [];
        this.debris = [];
        this.currentAxis = 'x'; // Alternates 'x' and 'z'
        this.speed = 0.12;
        this.direction = 1;

        // Initial Block Box Size
        this.boxHeight = 0.6;
        this.boxSize = { x: 3.2, z: 3.2 };
        this.spawnDistance = 6.0;

        // Container & Three.js Core
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();

        // Background Color HSL Initial
        this.hue = 210; // Start Cyan/Blue
        this.updateBackgroundHue(this.hue);

        // Camera Setup (Orthographic for sleek clean look)
        const aspect = window.innerWidth / window.innerHeight;
        const d = 7;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
        this.camera.position.set(12, 14, 12);
        this.camera.lookAt(0, 2, 0);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        this.dirLight.position.set(10, 20, 15);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.scene.add(this.dirLight);

        // Base Foundation Platform
        this.initBase();
        this.initEvents();

        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    updateBackgroundHue(h) {
        const topColor = new THREE.Color(`hsl(${h}, 50%, 15%)`);
        const botColor = new THREE.Color(`hsl(${(h + 40) % 360}, 60%, 8%)`);
        this.scene.background = topColor;
        this.scene.fog = new THREE.Fog(topColor, 15, 45);
    }

    initBase() {
        // Base Block
        const baseGeom = new THREE.BoxGeometry(this.boxSize.x, 3.0, this.boxSize.z);
        const baseMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(`hsl(${this.hue}, 70%, 50%)`),
            roughness: 0.3
        });
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.position.set(0, -1.5, 0);
        baseMesh.receiveShadow = true;
        this.scene.add(baseMesh);

        this.stack.push({
            mesh: baseMesh,
            position: { x: 0, z: 0 },
            size: { x: this.boxSize.x, z: this.boxSize.z }
        });

        // High Score UI
        document.getElementById('high-score-val').innerText = this.highScore;
    }

    spawnNextBlock() {
        const prev = this.stack[this.stack.length - 1];
        const y = this.stack.length * this.boxHeight;
        this.currentAxis = (this.stack.length % 2 === 1) ? 'x' : 'z';

        const geom = new THREE.BoxGeometry(this.boxSize.x, this.boxHeight, this.boxSize.z);
        const blockHue = (this.hue + (this.stack.length * 6)) % 360;
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(`hsl(${blockHue}, 75%, 55%)`),
            roughness: 0.25,
            metalness: 0.1
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (this.currentAxis === 'x') {
            mesh.position.set(-this.spawnDistance, y, prev.position.z);
        } else {
            mesh.position.set(prev.position.x, y, -this.spawnDistance);
        }

        this.activeBlock = {
            mesh: mesh,
            axis: this.currentAxis,
            size: { x: this.boxSize.x, z: this.boxSize.z }
        };

        this.scene.add(mesh);
    }

    placeBlock() {
        if (!this.isPlaying || this.isGameOver) {
            this.startGame();
            return;
        }

        if (!this.activeBlock) return;

        const prev = this.stack[this.stack.length - 1];
        const active = this.activeBlock;
        const axis = active.axis;

        const delta = active.mesh.position[axis] - prev.position[axis];
        const absDelta = Math.abs(delta);
        const maxOverlap = active.size[axis];

        // 1. PERFECT HIT (Delta < 0.09 units)
        if (absDelta < 0.09) {
            // Snap position exactly
            active.mesh.position[axis] = prev.position[axis];
            this.combo++;
            
            window.soundEngine.playNote(this.combo);
            this.showComboBadge(`PERFECT! x${this.combo}`);

            // Soft Failure Recovery: Grow stack size slightly after 3 perfects!
            if (this.combo >= 3) {
                window.soundEngine.playComboBonus();
                this.boxSize.x = Math.min(3.2, this.boxSize.x + 0.15);
                this.boxSize.z = Math.min(3.2, this.boxSize.z + 0.15);
            }

            this.finalizeBlockPlacement(active.mesh.position.x, active.mesh.position.z);
            return;
        }

        // 2. COMPLETE MISS -> GAME OVER
        if (absDelta >= maxOverlap) {
            this.triggerGameOver(active.mesh);
            return;
        }

        // 3. SLICE BLOCK (Part Overlaps, Part Falls Off)
        this.combo = 0;
        this.hideComboBadge();
        window.soundEngine.playSlice();

        const overlap = maxOverlap - absDelta;
        const newSize = { ...active.size };
        newSize[axis] = overlap;

        const newPos = { ...active.mesh.position };
        newPos[axis] = prev.position[axis] + (delta / 2);

        // Remove active moving mesh and replace with cut mesh
        this.scene.remove(active.mesh);

        const cutGeom = new THREE.BoxGeometry(newSize.x, this.boxHeight, newSize.z);
        const cutMat = active.mesh.material;
        const cutMesh = new THREE.Mesh(cutGeom, cutMat);
        cutMesh.position.set(newPos.x, active.mesh.position.y, newPos.z);
        cutMesh.castShadow = true;
        cutMesh.receiveShadow = true;
        this.scene.add(cutMesh);

        // Spawn Falling Debris Mesh
        const debrisSize = { ...active.size };
        debrisSize[axis] = absDelta;

        const debrisGeom = new THREE.BoxGeometry(debrisSize.x, this.boxHeight, debrisSize.z);
        const debrisMesh = new THREE.Mesh(debrisGeom, cutMat);

        const debrisSign = delta > 0 ? 1 : -1;
        const debrisPos = { ...newPos };
        debrisPos[axis] = newPos[axis] + (debrisSign * (overlap / 2 + absDelta / 2));

        debrisMesh.position.set(debrisPos.x, active.mesh.position.y, debrisPos.z);
        this.scene.add(debrisMesh);

        this.debris.push({
            mesh: debrisMesh,
            rotSpeed: { x: (Math.random() - 0.5) * 0.1, z: (Math.random() - 0.5) * 0.1 },
            fallSpeed: 0.15
        });

        // Update Box Size for next block
        this.boxSize[axis] = overlap;
        this.finalizeBlockPlacement(newPos.x, newPos.z);
    }

    finalizeBlockPlacement(posX, posZ) {
        this.stack.push({
            mesh: this.activeBlock.mesh,
            position: { x: posX, z: posZ },
            size: { x: this.boxSize.x, z: this.boxSize.z }
        });

        this.score = this.stack.length - 1;
        document.getElementById('score-val').innerText = this.score;

        // Dynamic Background Color Transition
        const currentHue = (this.hue + (this.score * 5)) % 360;
        this.updateBackgroundHue(currentHue);

        // Camera Smooth Target Ascent
        const targetY = (this.stack.length * this.boxHeight) + 14;
        this.cameraTargetY = targetY;

        this.spawnNextBlock();
    }

    triggerGameOver(fallingMesh) {
        this.isGameOver = true;
        this.isPlaying = false;
        window.soundEngine.playGameOver();

        // Tumble falling active mesh
        if (fallingMesh) {
            this.debris.push({
                mesh: fallingMesh,
                rotSpeed: { x: 0.1, z: 0.1 },
                fallSpeed: 0.2
            });
        }

        // High score save check
        if (this.score > this.highScore) {
            this.highScore = this.score;
            document.getElementById('high-score-val').innerText = this.highScore;
            window.storageManager.save({ highScore: this.highScore });
        }

        document.getElementById('modal-score-val').innerText = this.score;
        document.getElementById('modal-high-score-val').innerText = `BEST: ${this.highScore}`;
        document.getElementById('game-over-modal').style.display = 'flex';
    }

    startGame() {
        // Reset state
        this.isPlaying = true;
        this.isGameOver = false;
        this.score = 0;
        this.combo = 0;
        this.boxSize = { x: 3.2, z: 3.2 };

        document.getElementById('score-val').innerText = '0';
        document.getElementById('game-over-modal').style.display = 'none';

        // Clear previous stack meshes
        for (let i = 1; i < this.stack.length; i++) {
            this.scene.remove(this.stack[i].mesh);
        }
        this.stack = [this.stack[0]];

        // Clear debris
        this.debris.forEach(d => this.scene.remove(d.mesh));
        this.debris = [];

        this.spawnNextBlock();
    }

    reviveGame() {
        document.getElementById('game-over-modal').style.display = 'none';
        this.isGameOver = false;
        this.isPlaying = true;
        this.boxSize = { x: Math.max(1.8, this.boxSize.x), z: Math.max(1.8, this.boxSize.z) };
        this.spawnNextBlock();
    }

    showComboBadge(text) {
        const badge = document.getElementById('combo-badge');
        badge.innerText = text;
        badge.classList.add('active');
        clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => badge.classList.remove('active'), 1000);
    }

    hideComboBadge() {
        document.getElementById('combo-badge').classList.remove('active');
    }

    initEvents() {
        const handleTap = (e) => {
            if (e.target.closest('.modal-card') || e.target.tagName === 'BUTTON') return;
            this.placeBlock();
        };

        window.addEventListener('pointerdown', handleTap);
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.placeBlock();
        });

        document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
        document.getElementById('btn-ad-revive').addEventListener('click', () => this.reviveGame());

        window.addEventListener('resize', () => {
            const aspect = window.innerWidth / window.innerHeight;
            const d = 7;
            this.camera.left = -d * aspect;
            this.camera.right = d * aspect;
            this.camera.top = d;
            this.camera.bottom = -d;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(this.animate);
        const delta = this.clock.getDelta();

        // 1. Move Active Block Ping-Pong
        if (this.isPlaying && this.activeBlock) {
            const axis = this.activeBlock.axis;
            const time = this.clock.getElapsedTime() * (2.2 + (this.score * 0.04));
            this.activeBlock.mesh.position[axis] = Math.sin(time) * 4.8;
        }

        // 2. Animate Falling Debris
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.mesh.position.y -= d.fallSpeed;
            d.mesh.rotation.x += d.rotSpeed.x;
            d.mesh.rotation.z += d.rotSpeed.z;

            if (d.mesh.position.y < -15) {
                this.scene.remove(d.mesh);
                this.debris.splice(i, 1);
            }
        }

        // 3. Camera Smooth Ascent Target
        const targetY = (this.stack.length * this.boxHeight) + 6;
        this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetY + 8, 0.05);
        this.camera.lookAt(0, targetY - 4, 0);

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.zenGame = new ZenStackGame();
});
