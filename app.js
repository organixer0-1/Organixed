import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* --- SYSTEM CONFIG & STATE --- */
const AppState = {
    user: localStorage.getItem('aura_user') || "Guest",
    course: localStorage.getItem('aura_course') || "strength",
    level: parseInt(localStorage.getItem('aura_lvl')) || 1,
    xp: parseInt(localStorage.getItem('aura_xp')) || 0,
    steps: parseInt(localStorage.getItem('aura_steps')) || 0,
    goal: parseInt(localStorage.getItem('aura_goal')) || 6000,
    theme: localStorage.getItem('aura_theme') || 'dark'
};

/* --- EXTENDED DATABASE OF WORKOUTS --- */
// Categories: Upper, Lower, Core, Hands/Legs, Neck, Back
const CourseData = {
    strength: [
        // Upper Body
        { id: 'str_u1', name: "Push Up Blitz (Upper)", category: 'Upper', baseTime: 30, baseXP: 100, anim: 'Punch' },
        { id: 'str_u2', name: "Tricep Dips (Arms)", category: 'Upper', baseTime: 40, baseXP: 120, anim: 'Wave' },
        { id: 'str_u3', name: "Shoulder Taps (Upper)", category: 'Upper', baseTime: 45, baseXP: 130, anim: 'Punch' },
        
        // Lower Body & Legs
        { id: 'str_l1', name: "Squat Power (Legs)", category: 'Lower', baseTime: 45, baseXP: 150, anim: 'Jump' },
        { id: 'str_l2', name: "Lunges (Legs)", category: 'Lower', baseTime: 60, baseXP: 140, anim: 'Walking' },
        { id: 'str_l3', name: "Calf Raises (Legs)", category: 'Lower', baseTime: 40, baseXP: 100, anim: 'Idle' },

        // Core & Back
        { id: 'str_c1', name: "Plank Hold (Core)", category: 'Core', baseTime: 45, baseXP: 150, anim: 'Idle' },
        { id: 'str_c2', name: "Superman Hold (Back)", category: 'Back', baseTime: 30, baseXP: 130, anim: 'Running' }, // Simulates lying down motion
        { id: 'str_c3', name: "Russian Twists (Core)", category: 'Core', baseTime: 50, baseXP: 160, anim: 'Dance' },
        
        // Specific Isolation (Neck/Hands)
        { id: 'str_iso1', name: "Neck Isometrics (Neck)", category: 'Neck', baseTime: 30, baseXP: 80, anim: 'Idle' },
        { id: 'str_iso2', name: "Fist Clinchers (Hands)", category: 'Hands', baseTime: 45, baseXP: 90, anim: 'ThumbsUp' }
    ],
    cardio: [
        { id: 'car_1', name: "HIIT Sprints", category: 'Full', baseTime: 30, baseXP: 110, anim: 'Running' },
        { id: 'car_2', name: "Jumping Jacks", category: 'Full', baseTime: 60, baseXP: 100, anim: 'Jump' },
        { id: 'car_3', name: "Burpee Burn", category: 'Full', baseTime: 45, baseXP: 180, anim: 'Dance' },
        { id: 'car_4', name: "High Knees", category: 'Legs', baseTime: 40, baseXP: 120, anim: 'Running' }
    ],
    zen: [
        { id: 'zen_1', name: "Box Breathing", category: 'Breath', baseTime: 60, baseXP: 80, anim: 'Sitting' },
        { id: 'zen_2', name: "Neck Rotations", category: 'Neck', baseTime: 45, baseXP: 90, anim: 'Idle' },
        { id: 'zen_3', name: "Lotus Flow", category: 'Yoga', baseTime: 90, baseXP: 140, anim: 'Sitting' },
        { id: 'zen_4', name: "4-7-8 Breathing", category: 'Breath', baseTime: 120, baseXP: 150, anim: 'Sitting' }
    ]
};

const WarmUpRoutine = [
    { name: "Head Tilts", duration: 10, anim: 'Idle' },
    { name: "Arm Circles", duration: 15, anim: 'Wave' },
    { name: "Torso Twists", duration: 15, anim: 'Dance' },
    { name: "Light Jog", duration: 15, anim: 'Walking' }
];

/* --- 1. AURA AI (GEMINI NANO WRAPPER) --- */
class AuraAI {
    constructor() {
        this.session = null;
    }

    async init() {
        if (window.ai && window.ai.languageModel) {
            try {
                this.session = await window.ai.languageModel.create();
                console.log("Gemini Nano: Initialized");
            } catch (e) { console.warn("Gemini Nano unavailable:", e); }
        }
    }

    async ask(prompt) {
        if (this.session) {
            try {
                return await this.session.prompt(prompt);
            } catch (e) { return this.heuristicFallback(prompt); }
        }
        return this.heuristicFallback(prompt);
    }

    heuristicFallback(prompt) {
        const p = prompt.toLowerCase();
        if(p.includes('hiit') || p.includes('strength')) return `Based on your ${AppState.course} course, high intensity is key. Keep intervals short but explosive.`;
        if(p.includes('neck') || p.includes('back')) return "For neck and back health, posture is priority. Keep your spine aligned during all exercises.";
        if(p.includes('level')) return `You are Level ${AppState.level}. Durations are scaled by +${Math.floor(AppState.level * 10)}%.`;
        return "I am processing your biometric data. Maintain consistency to upgrade your neural firmware.";
    }
}

/* --- 2. 3D VISUALIZATION ENGINE --- */
class VisualEngine {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.mixers = [];
        this.actions = {};
        this.activeAction = null;
        this.model = null;
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        
        // Lighting
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 3);
        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(3, 10, 10);
        this.scene.add(hemi, dir);

        this.camera.position.set(0, 1, 5);

        // Load Model
        const loader = new GLTFLoader();
        loader.load('https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.y = -2;
            this.scene.add(this.model);
            const mixer = new THREE.AnimationMixer(this.model);
            gltf.animations.forEach(c => this.actions[c.name] = mixer.clipAction(c));
            this.mixers.push(mixer);
            this.play('Idle');
        });

        this.animate();
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    play(name) {
        const next = this.actions[name] || this.actions['Idle'];
        if (this.activeAction !== next) {
            this.activeAction?.fadeOut(0.5);
            next.reset().fadeIn(0.5).play();
            this.activeAction = next;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.mixers.forEach(m => m.update(0.016));
        this.renderer.render(this.scene, this.camera);
    }
    
    setMode(mode) {
        if(!this.model) return;
        
        if (mode === 'workout') {
            // Bring robot closer and center for instruction
            const targetZ = 2.5;
            const targetY = -1.5;
            this.camera.position.z = targetZ;
            this.model.position.y = targetY;
        } else {
            // Reset to dashboard view
            this.camera.position.z = 5;
            this.model.position.y = -2;
        }
    }
}

/* --- 3. WORKOUT MANAGER (Timer, Voice, Cam, Sequences) --- */
class WorkoutManager {
    constructor(app) {
        this.app = app;
        this.timerInterval = null;
        this.videoEl = document.getElementById('webcam-feed');
        this.stream = null;
        this.currentSequence = [];
        this.sequenceIndex = 0;
    }

    async start(workoutId) {
        // 1. Fetch Main Workout Data
        const base = [...CourseData.strength, ...CourseData.cardio, ...CourseData.zen].find(w => w.id === workoutId);
        
        // 2. Scaling Logic: Duration increases with level
        const mainDuration = Math.floor(base.baseTime * (1 + (AppState.level * 0.1)));
        const xpReward = Math.floor(base.baseXP * (1 + (AppState.level * 0.05)));

        // 3. UI Shift
        document.getElementById('active-workout-page').classList.remove('hidden');
        document.getElementById('app-interface').classList.add('hidden');
        this.app.visuals.setMode('workout');
        
        // 4. Start Camera
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.videoEl.srcObject = this.stream;
        } catch(e) { console.warn("Camera denied"); }

        // 5. Build Sequence: Warmup -> Main -> Breathing
        this.currentSequence = [];
        
        // Add Warmups (Fixed 3-4 moves)
        WarmUpRoutine.forEach(w => {
            this.currentSequence.push({
                type: 'WARMUP',
                name: w.name,
                duration: w.duration, // Short duration for warmup
                anim: w.anim
            });
        });

        // Add Main Workout
        this.currentSequence.push({
            type: 'WORKOUT',
            name: base.name,
            duration: mainDuration,
            anim: base.anim,
            xp: xpReward
        });

        // Add Cooldown Breathing
        this.currentSequence.push({
            type: 'COOLDOWN',
            name: "Deep Breathing Reset",
            duration: 20,
            anim: 'Sitting'
        });

        this.sequenceIndex = 0;
        this.runNextPhase();
    }

    runNextPhase() {
        if(this.sequenceIndex >= this.currentSequence.length) {
            // Sequence finished - calculate total XP from the main workout
            const mainSession = this.currentSequence.find(s => s.type === 'WORKOUT');
            this.complete(mainSession.xp || 50);
            return;
        }

        const step = this.currentSequence[this.sequenceIndex];
        this.sequenceIndex++;

        // Update Robot Animation
        this.app.visuals.play(step.anim);

        // Update Text
        document.getElementById('instruction-text').innerText = step.type; // "WARMUP", "WORKOUT", "COOLDOWN"
        document.getElementById('instruction-text').style.color = 
            step.type === 'WARMUP' ? '#fbbf24' : 
            step.type === 'COOLDOWN' ? '#60a5fa' : '#10b981';

        this.runSession(step.name, step.duration);
    }

    runSession(name, totalTime) {
        let timeLeft = totalTime;
        document.getElementById('workout-title').innerText = name;
        this.speak(`Starting ${name}. ${totalTime} seconds.`);

        // Reset progress bar
        document.getElementById('workout-progress').style.width = '0%';

        this.timerInterval = setInterval(() => {
            timeLeft--;
            const min = Math.floor(timeLeft/60);
            const sec = timeLeft%60;
            document.getElementById('workout-timer').innerText = `${min}:${sec<10?'0'+sec:sec}`;
            
            const progress = ((totalTime - timeLeft) / totalTime) * 100;
            document.getElementById('workout-progress').style.width = `${progress}%`;

            if(timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.speak("Done.");
                setTimeout(() => this.runNextPhase(), 1000); // Small pause before next
            } else if (timeLeft === 5) {
                this.speak("Five seconds.");
            }
        }, 1000);
    }

    complete(xp) {
        this.speak("Sequence complete. System upgraded.");
        this.app.addXP(xp);
        alert(`SESSION COMPLETE\n+${xp} XP Gained`);
        this.stop();
    }

    stop() {
        clearInterval(this.timerInterval);
        if(this.stream) this.stream.getTracks().forEach(t => t.stop());
        document.getElementById('active-workout-page').classList.add('hidden');
        document.getElementById('app-interface').classList.remove('hidden');
        this.app.visuals.setMode('dashboard');
        this.app.visuals.play('Idle');
    }

    speak(text) {
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 1.0;
            window.speechSynthesis.speak(u);
        }
    }
}

/* --- 4. MAIN APP CONTROLLER --- */
class App {
    constructor() {
        this.ai = new AuraAI();
        this.visuals = new VisualEngine();
        this.workoutManager = new WorkoutManager(this);
        this.init();
    }

    init() {
        this.ai.init();
        this.applyTheme();
        this.setupEventListeners();
        
        // Check Login State
        if(localStorage.getItem('aura_user')) {
            document.getElementById('login-sequence').classList.add('hidden');
            document.getElementById('app-interface').classList.remove('hidden');
            document.getElementById('app-interface').classList.add('app-active');
            this.loadDashboard();
        }

        // Course Selection Logic
        document.querySelectorAll('.course-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.course-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.course = btn.dataset.course;
            });
        });
    }

    setupEventListeners() {
        // Login
        document.getElementById('auth-btn').onclick = () => {
            const name = document.getElementById('user-input').value || "Operator";
            AppState.user = name;
            this.saveState();
            this.loginAnim();
        };

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById(`view-${e.target.dataset.target}`).classList.add('active');
            });
        });

        // Workout Cancel
        document.getElementById('cancel-workout-btn').onclick = () => this.workoutManager.stop();

        // Settings
        document.getElementById('open-settings').onclick = () => this.toggleSettings(true);
        document.getElementById('theme-toggle-btn').onclick = () => {
            AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
            this.saveState();
            this.applyTheme();
        };

        // AI Chat
        document.getElementById('ai-send').onclick = async () => {
            const inp = document.getElementById('ai-prompt');
            const txt = inp.value;
            if(!txt) return;
            this.addMsg(txt, 'user');
            inp.value = '';
            const id = this.addMsg('Thinking...', 'ai');
            const resp = await this.ai.ask(txt);
            document.getElementById(id).innerText = resp;
        };
    }

    loginAnim() {
        const log = document.getElementById('boot-logs');
        log.innerHTML = ">> BIOMETRICS CONFIRMED<br>>> COURSE: " + AppState.course.toUpperCase();
        document.getElementById('auth-btn').style.background = "#10b981";
        setTimeout(() => {
            document.getElementById('login-sequence').style.opacity = 0;
            setTimeout(() => {
                document.getElementById('login-sequence').classList.add('hidden');
                document.getElementById('app-interface').classList.remove('hidden');
                setTimeout(() => document.getElementById('app-interface').classList.add('app-active'), 50);
                this.loadDashboard();
            }, 800);
        }, 1500);
    }

    loadDashboard() {
        this.updateHUD();
        this.generateRandomLeaderboard();
        this.renderWorkouts();
        
        // Simulate Steps
        setInterval(() => {
            AppState.steps += Math.floor(Math.random() * 5);
            this.updateHUD();
        }, 5000);
    }

    renderWorkouts() {
        // Dashboard recommendations
        const container = document.getElementById('dashboard-workouts');
        const list = CourseData[AppState.course];
        
        // Show recommended (first 4)
        container.innerHTML = list.slice(0, 4).map(w => `
            <button class="action-btn" onclick="app.workoutManager.start('${w.id}')">
                <i data-lucide="play"></i> 
                <div style="text-align:left">
                    <div>${w.name}</div>
                    <div style="font-size:0.6rem; opacity:0.7">${w.baseTime}s • ${w.category}</div>
                </div>
            </button>
        `).join('');

        // Challenges (Scaled) - Show all
        const cContainer = document.getElementById('challenge-list');
        cContainer.innerHTML = list.map(w => {
            const scaledTime = Math.floor(w.baseTime * (1 + (AppState.level * 0.15))); 
            const scaledXP = Math.floor(w.baseXP * (1 + (AppState.level * 0.1)));
            return `
            <div class="challenge-item" onclick="app.workoutManager.start('${w.id}')">
                <div>
                    <strong>${w.name}</strong><br>
                    <span style="font-size:0.8rem; color:var(--text-secondary)">${w.category} | ${scaledTime}s</span>
                </div>
                <div style="text-align:right">
                    <span class="difficulty-badge">LVL ${AppState.level}</span>
                    <div style="color:var(--success); font-weight:700">+${scaledXP} XP</div>
                </div>
            </div>`;
        }).join('');
        
        if(window.lucide) window.lucide.createIcons();
    }

    generateRandomLeaderboard() {
        const names = ["K-Pax", "Neo_Fit", "Trinity", "Glitch", "Cipher", "Vortex", "Echo", "Nova", "Flux", "Zen"];
        const list = document.getElementById('rank-list');
        list.innerHTML = '';
        
        const data = names.map(n => ({
            name: n,
            score: Math.floor(Math.random() * 15000) + 2000
        }));
        
        // Add User
        data.push({ name: AppState.user + " (YOU)", score: AppState.steps, isMe: true });
        data.sort((a,b) => b.score - a.score);

        data.forEach((u, i) => {
            list.innerHTML += `
            <div class="rank-row" style="${u.isMe?'background:rgba(99,102,241,0.1); border-left:3px solid var(--accent)':''}">
                <div class="rank-num" style="color:${i<3?'var(--accent)':'var(--text-secondary)'}">#${i+1}</div>
                <div class="rank-name">${u.name}</div>
                <div class="rank-score">${u.score.toLocaleString()}</div>
            </div>`;
        });
    }

    addXP(amount) {
        AppState.xp += amount;
        const req = AppState.level * 500;
        if(AppState.xp >= req) {
            AppState.level++;
            AppState.xp = 0;
            alert("LEVEL UP! SYSTEM UPGRADED.");
        }
        this.saveState();
        this.updateHUD();
        this.renderWorkouts(); // Re-render to scale difficulty
    }

    updateHUD() {
        document.getElementById('hud-username').innerText = AppState.user;
        document.getElementById('hud-level').innerText = `LVL ${AppState.level}`;
        document.getElementById('hud-course').innerText = AppState.course.toUpperCase();
        document.getElementById('step-display').innerText = AppState.steps.toLocaleString();
        
        const req = AppState.level * 500;
        const pct = (AppState.xp / req) * 100;
        const circle = document.querySelector('.progress-ring__circle');
        const r = circle.r.baseVal.value;
        const c = r * 2 * Math.PI;
        circle.style.strokeDashoffset = c - (pct / 100) * c;
    }

    addMsg(txt, type) {
        const div = document.createElement('div');
        div.className = `msg ${type}`;
        div.innerText = txt;
        div.id = 'msg-' + Date.now();
        document.getElementById('chat-feed').appendChild(div);
        return div.id;
    }

    toggleSettings(show) {
        const m = document.getElementById('settings-modal');
        show ? m.classList.remove('hidden') : m.classList.add('hidden');
        if(show) {
            document.getElementById('edit-name').value = AppState.user;
            document.getElementById('edit-goal').value = AppState.goal;
        }
    }

    saveProfile() {
        AppState.user = document.getElementById('edit-name').value;
        AppState.goal = document.getElementById('edit-goal').value;
        this.saveState();
        this.updateHUD();
        this.toggleSettings(false);
    }

    applyTheme() {
        document.body.className = `theme-${AppState.theme}`;
    }

    saveState() {
        localStorage.setItem('aura_user', AppState.user);
        localStorage.setItem('aura_course', AppState.course);
        localStorage.setItem('aura_lvl', AppState.level);
        localStorage.setItem('aura_xp', AppState.xp);
        localStorage.setItem('aura_steps', AppState.steps);
        localStorage.setItem('aura_theme', AppState.theme);
    }
}

// Global Access
window.app = new App();