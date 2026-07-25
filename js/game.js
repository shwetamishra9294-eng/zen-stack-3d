// Zen Stack 3D - Fixed 3D Scene Purge & Stack Placement Architecture

class ZenStackGame {
    constructor() {
        this.saveData = window.storageManager.load();
        this.score = 0;
        this.highScore = this.saveData.highScore || 0;
        this.coins = this.saveData.coins || 200;
        this.selectedSkin = this.saveData.selectedSkin || 'classic';
        this.unlockedSkins = this.saveData.unlockedSkins || ['classic'];
        this.unlockedLandmarks = this.saveData.unlockedLandmarks || ['skyscraper'];

        this.combo = 0;
        this.feverActive = false;
        this.isPlaying = false;
        this.isGameOver = false;
        this.firstTapDone = false;

        // Stack dimensions & motion state
        this.stack = [];
        this.debris = [];
        this.particles = [];
        this.activeBlock = null;
        this.currentAxis = 'x';
        this.boxHeight = 0.6;
        this.boxSize = { x: 3.2, z: 3.2 };
        this.spawnDistance = 6.0;

        // Container & Three.js Engine Setup
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();

        this.hue = 210;
        this.updateBackgroundHue(this.hue);

        const aspect = window.innerWidth / window.innerHeight;
        const d = 7;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
        this.cameraBasePos = new THREE.Vector3(12, 14, 12);
        this.camera.position.copy(this.cameraBasePos);
        this.camera.lookAt(0, 2, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        this.scene.add(ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
        this.dirLight.position.set(10, 22, 15);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.scene.add(this.dirLight);

        this.shakeIntensity = 0;

        this.initBase();
        this.initEvents();

        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    updateBackgroundHue(h) {
        if (this.selectedSkin === 'cyberpunk') {
            const topColor = new THREE.Color(0x050b14);
            this.scene.background = topColor;
            this.scene.fog = new THREE.Fog(topColor, 16, 45);
            return;
        }

        const topColor = new THREE.Color(`hsl(${h}, 50%, 14%)`);
        this.scene.background = topColor;
        this.scene.fog = new THREE.Fog(topColor, 16, 45);
    }

    getSkinMaterial(blockHue) {
        if (this.selectedSkin === 'cyberpunk') {
            return new THREE.MeshStandardMaterial({
                color: new THREE.Color(`hsl(${(blockHue + 180) % 360}, 100%, 50%)`),
                roughness: 0.1,
                metalness: 0.8,
                emissive: new THREE.Color(`hsl(${(blockHue + 180) % 360}, 100%, 20%)`)
            });
        } else if (this.selectedSkin === 'bamboo') {
            return new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x15803d),
                roughness: 0.7,
                metalness: 0.0
            });
        } else if (this.selectedSkin === 'gold') {
            return new THREE.MeshStandardMaterial({
                color: new THREE.Color(0xfbbf24),
                roughness: 0.2,
                metalness: 0.9
            });
        } else {
            return new THREE.MeshStandardMaterial({
                color: new THREE.Color(`hsl(${blockHue}, 80%, 58%)`),
                roughness: 0.25,
                metalness: 0.1
            });
        }
    }

    initBase() {
        const baseGeom = new THREE.BoxGeometry(this.boxSize.x, 3.0, this.boxSize.z);
        const baseMat = this.getSkinMaterial(this.hue);
        this.baseMesh = new THREE.Mesh(baseGeom, baseMat);
        this.baseMesh.position.set(0, -1.5, 0);
        this.baseMesh.receiveShadow = true;
        this.scene.add(this.baseMesh);

        this.stack = [{
            mesh: this.baseMesh,
            position: { x: 0, z: 0 },
            size: { x: this.boxSize.x, z: this.boxSize.z }
        }];

        document.getElementById('high-score-val').innerText = this.highScore;
        document.getElementById('coins-val').innerText = this.coins;
        this.updateLandmarkBadge();
    }

    updateLandmarkBadge() {
        let name = '🏢 Skyscraper';
        if (this.score >= 100) name = '🏰 Fantasy Castle';
        else if (this.score >= 75) name = '🚀 Space Elevator';
        else if (this.score >= 50) name = '⛩️ Zen Pagoda';

        document.getElementById('landmark-badge').innerText = name;
    }

    spawnNextBlock() {
        if (!this.stack || this.stack.length === 0) return;

        const prev = this.stack[this.stack.length - 1];
        const y = this.stack.length * this.boxHeight;
        this.currentAxis = (this.stack.length % 2 === 1) ? 'x' : 'z';

        const geom = new THREE.BoxGeometry(this.boxSize.x, this.boxHeight, this.boxSize.z);
        const blockHue = (this.hue + (this.stack.length * 6)) % 360;
        const mat = this.getSkinMaterial(blockHue);

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

    triggerParticleExplosion(pos, color) {
        const particleCount = 18;
        const geom = new THREE.SphereGeometry(0.08, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: color });

        for (let i = 0; i < particleCount; i++) {
            const p = new THREE.Mesh(geom, mat);
            p.position.copy(pos);

            const angle = Math.random() * Math.PI * 2;
            const speed = 0.08 + Math.random() * 0.12;

            this.scene.add(p);
            this.particles.push({
                mesh: p,
                vel: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    0.05 + Math.random() * 0.1,
                    Math.sin(angle) * speed
                ),
                life: 1.0
            });
        }
    }

    triggerScreenShake() {
        this.shakeIntensity = 0.22;
    }

    placeBlock() {
        if (!this.firstTapDone) {
            this.firstTapDone = true;
            document.getElementById('onboarding-overlay').style.opacity = '0';
        }

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

        // 1. PERFECT HIT (Delta < 0.09)
        if (absDelta < 0.09) {
            active.mesh.position[axis] = prev.position[axis];
            this.combo++;
            this.triggerScreenShake();

            this.triggerParticleExplosion(active.mesh.position, 0xfbbf24);

            if (this.combo >= 5) {
                this.feverActive = true;
                window.soundEngine.playFeverChime();
                this.showComboBadge(`🔥 FEVER MODE x${this.combo}!`, true);
                this.boxSize.x = 3.2;
                this.boxSize.z = 3.2;
            } else if (this.combo >= 3) {
                window.soundEngine.playNote(this.combo);
                this.showComboBadge(`PERFECT! x${this.combo}`);
                this.boxSize.x = Math.min(3.2, this.boxSize.x + 0.18);
                this.boxSize.z = Math.min(3.2, this.boxSize.z + 0.18);
            } else {
                window.soundEngine.playNote(this.combo);
                this.showComboBadge(`PERFECT! x${this.combo}`);
            }

            this.finalizeBlockPlacement(active.mesh, active.mesh.position.x, active.mesh.position.z);
            return;
        }

        // 2. COMPLETE MISS -> GAME OVER
        if (absDelta >= maxOverlap) {
            this.triggerGameOver(active.mesh);
            return;
        }

        // 3. SLICE BLOCK
        this.combo = 0;
        this.feverActive = false;
        this.hideComboBadge();
        window.soundEngine.playSlice();

        const overlap = maxOverlap - absDelta;
        const newSize = { ...active.size };
        newSize[axis] = overlap;

        const newPos = { ...active.mesh.position };
        newPos[axis] = prev.position[axis] + (delta / 2);

        this.scene.remove(active.mesh);

        const cutGeom = new THREE.BoxGeometry(newSize.x, this.boxHeight, newSize.z);
        const cutMat = active.mesh.material;
        const cutMesh = new THREE.Mesh(cutGeom, cutMat);
        cutMesh.position.set(newPos.x, active.mesh.position.y, newPos.z);
        cutMesh.castShadow = true;
        cutMesh.receiveShadow = true;
        this.scene.add(cutMesh);

        // Falling Debris
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
            rotSpeed: { x: (Math.random() - 0.5) * 0.12, z: (Math.random() - 0.5) * 0.12 },
            fallSpeed: 0.16
        });

        this.boxSize[axis] = overlap;
        // Fix: Store cutMesh in stack instead of old active.mesh!
        this.finalizeBlockPlacement(cutMesh, newPos.x, newPos.z);
    }

    finalizeBlockPlacement(mesh, posX, posZ) {
        this.stack.push({
            mesh: mesh,
            position: { x: posX, z: posZ },
            size: { x: this.boxSize.x, z: this.boxSize.z }
        });

        const pts = this.feverActive ? 2 : 1;
        this.score += pts;
        this.coins += pts * 2;

        const scoreEl = document.getElementById('score-val');
        scoreEl.innerText = this.score;
        scoreEl.classList.add('bounce');
        setTimeout(() => scoreEl.classList.remove('bounce'), 150);

        document.getElementById('coins-val').innerText = this.coins;
        this.updateLandmarkBadge();

        const currentHue = (this.hue + (this.score * 5)) % 360;
        this.updateBackgroundHue(currentHue);

        this.spawnNextBlock();
    }

    triggerGameOver(fallingMesh) {
        this.isGameOver = true;
        this.isPlaying = false;
        window.soundEngine.playGameOver();

        if (fallingMesh) {
            this.debris.push({
                mesh: fallingMesh,
                rotSpeed: { x: 0.12, z: 0.12 },
                fallSpeed: 0.22
            });
        }

        if (this.score > this.highScore) {
            this.highScore = this.score;
            document.getElementById('high-score-val').innerText = this.highScore;
        }

        window.storageManager.save({
            highScore: this.highScore,
            coins: this.coins,
            selectedSkin: this.selectedSkin,
            unlockedSkins: this.unlockedSkins,
            unlockedLandmarks: this.unlockedLandmarks
        });

        document.getElementById('modal-score-val').innerText = this.score;
        document.getElementById('modal-high-score-val').innerText = `BEST: ${this.highScore}`;
        document.getElementById('game-over-modal').style.display = 'flex';
    }

    startGame() {
        this.isPlaying = true;
        this.isGameOver = false;
        this.score = 0;
        this.combo = 0;
        this.feverActive = false;
        this.boxSize = { x: 3.2, z: 3.2 };

        document.getElementById('score-val').innerText = '0';
        document.getElementById('game-over-modal').style.display = 'none';

        // Fix: Purge ALL 3D meshes from scene except the foundation baseMesh
        const toRemove = [];
        this.scene.traverse((child) => {
            if (child.isMesh && child !== this.baseMesh) {
                toRemove.push(child);
            }
        });
        toRemove.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
        });

        // Reset stack to base foundation mesh only
        this.stack = [{
            mesh: this.baseMesh,
            position: { x: 0, z: 0 },
            size: { x: 3.2, z: 3.2 }
        }];

        this.activeBlock = null;
        this.debris = [];
        this.particles = [];

        // Reset camera position & target directly to base
        this.cameraBasePos.set(12, 14, 12);
        this.camera.position.copy(this.cameraBasePos);
        this.camera.lookAt(0, 2, 0);

        this.updateBackgroundHue(this.hue);
        this.spawnNextBlock();
    }

    reviveGame() {
        document.getElementById('game-over-modal').style.display = 'none';
        this.isGameOver = false;
        this.isPlaying = true;
        this.boxSize = { x: Math.max(2.0, this.boxSize.x), z: Math.max(2.0, this.boxSize.z) };
        this.spawnNextBlock();
    }

    showComboBadge(text, isFever = false) {
        const badge = document.getElementById('combo-badge');
        badge.innerText = text;
        if (isFever) badge.classList.add('fever-badge');
        else badge.classList.remove('fever-badge');

        badge.classList.add('active');
        clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => badge.classList.remove('active'), 1100);
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

        document.getElementById('btn-restart').addEventListener('click', (e) => {
            e.stopPropagation();
            this.startGame();
        });
        document.getElementById('btn-ad-revive').addEventListener('click', (e) => {
            e.stopPropagation();
            this.reviveGame();
        });

        document.getElementById('btn-open-shop').addEventListener('click', (e) => {
            e.stopPropagation();
            this.renderSkinShop();
            document.getElementById('shop-modal').style.display = 'flex';
        });
        document.getElementById('btn-close-shop').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('shop-modal').style.display = 'none';
        });

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

    renderSkinShop() {
        const container = document.getElementById('skin-grid');
        container.innerHTML = '';

        const skins = [
            { id: 'classic', title: 'Classic Gradient', price: 0, color: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
            { id: 'cyberpunk', title: 'Cyberpunk Neon', price: 150, color: 'linear-gradient(135deg, #06b6d4, #ec4899)' },
            { id: 'bamboo', title: 'Zen Bamboo', price: 300, color: 'linear-gradient(135deg, #15803d, #86efac)' },
            { id: 'gold', title: 'Gold Foil VIP', price: 500, color: 'linear-gradient(135deg, #fbbf24, #d97706)' }
        ];

        skins.forEach(skin => {
            const card = document.createElement('div');
            const isUnlocked = this.unlockedSkins.includes(skin.id);
            const isSelected = this.selectedSkin === skin.id;

            card.className = `skin-card ${isSelected ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="skin-preview" style="background: ${skin.color}"></div>
                <div class="skin-title">${skin.title}</div>
                <button class="skin-btn ${isSelected ? 'btn-equipped' : (isUnlocked ? 'btn-equip' : 'btn-buy')}">
                    ${isSelected ? 'EQUIPPED' : (isUnlocked ? 'EQUIP' : `🪙 ${skin.price}`)}
                </button>
            `;

            card.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSelected) return;

                if (isUnlocked) {
                    this.selectedSkin = skin.id;
                    window.storageManager.save({
                        highScore: this.highScore,
                        coins: this.coins,
                        selectedSkin: this.selectedSkin,
                        unlockedSkins: this.unlockedSkins,
                        unlockedLandmarks: this.unlockedLandmarks
                    });
                    this.renderSkinShop();
                } else if (this.coins >= skin.price) {
                    this.coins -= skin.price;
                    this.unlockedSkins.push(skin.id);
                    this.selectedSkin = skin.id;
                    document.getElementById('coins-val').innerText = this.coins;

                    window.storageManager.save({
                        highScore: this.highScore,
                        coins: this.coins,
                        selectedSkin: this.selectedSkin,
                        unlockedSkins: this.unlockedSkins,
                        unlockedLandmarks: this.unlockedLandmarks
                    });
                    this.renderSkinShop();
                }
            });

            container.appendChild(card);
        });
    }

    animate() {
        requestAnimationFrame(this.animate);
        const delta = this.clock.getDelta();

        if (this.isPlaying && this.activeBlock) {
            const axis = this.activeBlock.axis;
            const speedScale = 2.2 + Math.min(2.5, this.score * 0.04);
            const time = this.clock.getElapsedTime() * speedScale;
            this.activeBlock.mesh.position[axis] = Math.sin(time) * 4.8;
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.add(p.vel);
            p.life -= delta * 2.5;
            p.mesh.scale.setScalar(Math.max(0.01, p.life));

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }

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

        if (this.isPlaying) {
            const targetY = (this.stack.length * this.boxHeight) + 6;
            this.cameraBasePos.y = THREE.MathUtils.lerp(this.cameraBasePos.y, targetY + 8, 0.06);

            if (this.shakeIntensity > 0) {
                this.camera.position.x = this.cameraBasePos.x + (Math.random() - 0.5) * this.shakeIntensity;
                this.camera.position.y = this.cameraBasePos.y + (Math.random() - 0.5) * this.shakeIntensity;
                this.camera.position.z = this.cameraBasePos.z + (Math.random() - 0.5) * this.shakeIntensity;
                this.shakeIntensity *= 0.85;
                if (this.shakeIntensity < 0.01) this.shakeIntensity = 0;
            } else {
                this.camera.position.copy(this.cameraBasePos);
            }

            this.camera.lookAt(0, targetY - 4, 0);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.zenGame = new ZenStackGame();
});
