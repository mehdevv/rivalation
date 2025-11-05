/**
 * Adventure Game - Complete Redesign
 * Clean, modular design with proper separation of concerns
 */

class AdventureGame {
    constructor() {
        // Core game properties
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'loading'; // loading, playing, paused
        this.lastTime = 0;
        this.deltaTime = 0;
        this.statsRefreshTimer = 0;
        this.debugMode = false; // Debug mode for collision visualization
        
        // Initialize canvas
        this.setupCanvas();
        
        // Game systems
        this.input = new InputManager(this);
        this.camera = new Camera(this);
        this.map = new MapManager(this);
        this.player = new Player(this);
        this.ui = new UIManager(this);
        this.auth = new AuthManager(this);
        this.feedback = new FeedbackManager(this);
        this.houseInteraction = new HouseInteractionManager(this);
        
        // Start the game
        this.init();
    }
    
    setupCanvas() {
        // Get actual screen dimensions
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Set canvas to full screen
        this.canvas.width = screenWidth;
        this.canvas.height = screenHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.camera.updateViewport();
            
            console.log(`📱 Screen resized: ${newWidth}x${newHeight}`);
        });
        
        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                const newWidth = window.innerWidth;
                const newHeight = window.innerHeight;
                
                this.canvas.width = newWidth;
                this.canvas.height = newHeight;
                this.camera.updateViewport();
                
                console.log(`🔄 Orientation changed: ${newWidth}x${newHeight}`);
            }, 100);
        });
    }
    
    async init() {
        console.log('🎮 Initializing Adventure Game...');
        
        // Check if user is on PC and show QR code message
        this.checkDeviceAndShowQR();
        
        // Always show loading screen first
        this.gameState = 'loading';
        this.ui.showLoading();
        
        try {
            // Initialize authentication
            await this.auth.init();
            
            // Setup auth state listener
            this.setupAuthStateListener();
            
            // Wait for Firebase to fully initialize and check auth state
            await this.waitForAuthState();
            
        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            this.showError('Failed to initialize game');
        }
    }
    
    checkDeviceAndShowQR() {
        // Check if user is on a desktop/PC device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        
        // If it's not mobile, not touch device, and not small screen, show QR code
        if (!isMobile && !isTouchDevice && !isSmallScreen) {
            console.log('🖥️ PC detected - showing QR code message');
            const pcMessage = document.getElementById('pcMessage');
            if (pcMessage) {
                pcMessage.style.display = 'flex';
            }
        } else {
            console.log('📱 Mobile device detected - hiding QR code message');
        }
    }
    
    async waitForAuthState() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 30; // 3 seconds max wait
            
            const check = () => {
                attempts++;
                console.log(`⏳ Checking auth state... (attempt ${attempts}/${maxAttempts})`);
                
                const currentUser = window.auth.currentUser;
                console.log("🔍 Current user:", currentUser ? currentUser.email : "No user");
                
                if (currentUser) {
                    console.log("✅ User already logged in:", currentUser.email);
                    // User is logged in, start game directly
                    this.startGame();
                resolve();
                } else if (attempts >= maxAttempts) {
                    console.log("❌ No user logged in after timeout, showing login form");
                    // User not logged in, show login form
                    this.showLogin();
                resolve();
                } else {
                    // Keep checking
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    // Setup auth state listener to handle login/logout
    setupAuthStateListener() {
        if (window.auth) {
            window.onAuthStateChanged(window.auth, (user) => {
                console.log("🔄 Auth state changed:", user ? user.email : "No user");
                
                if (user) {
                    // User is logged in
                    console.log("✅ User logged in:", user.email);
                    this.auth.user = user;
                    this.startGame();
                } else {
                    // User is logged out
                    console.log("❌ User logged out");
                    this.auth.user = null;
                    this.showLogin();
                }
            });
        }
    }
    
    async startGame() {
        console.log('🚀 Starting game...');
        this.gameState = 'loading';
        this.ui.showLoading();
        
        try {
            // Load all game assets
            await Promise.all([
                this.map.loadAssets(),
                this.player.loadAssets()
            ]);
            
            // Initialize game systems
            this.camera.init();
            this.input.init();
            
            // Load saved zoom level
            if (this.ui && this.ui.loadZoomLevel) {
                this.ui.loadZoomLevel();
            }
            
            // Start game loop
            this.gameState = 'playing';
            this.ui.hideLoading();
            this.ui.hideLogin();
            
            // Force refresh user stats to ensure latest data from Firestore
            if (this.auth && this.auth.user) {
                this.auth.refreshUserStats();
            }
            
            this.gameLoop();
            
            console.log('✅ Game started successfully!');
            
        } catch (error) {
            console.error('❌ Failed to start game:', error);
            this.showError('Failed to load game assets');
        }
    }
    
    showLogin() {
        console.log("🔐 Showing login screen...");
        this.gameState = 'login';
        this.ui.showLogin();
    }
    
    hideLogin() {
        console.log("🔒 Hiding login screen...");
        this.ui.hideLogin();
    }
    
    showError(message) {
        this.ui.showError(message);
    }
    
    
    gameLoop(currentTime = 0) {
        if (this.gameState !== 'playing') return;
        
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Track stats refresh timer
        this.statsRefreshTimer += this.deltaTime;
        
        // Refresh user stats from Firestore every 30 seconds to stay synchronized
        if (this.statsRefreshTimer >= 30000) {
            this.auth.refreshUserStats();
            this.statsRefreshTimer = 0;
        }
        
        // Update game systems
        this.update();
        
        // Render game
        this.render();
        
        // Continue loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update() {
        // Update input
        this.input.update();
        
        // Update player
        this.player.update(this.deltaTime);
        
        // Update camera
        this.camera.update();
        
        // Update feedback system
        this.feedback.update();
        
        // Update house interaction system
        this.houseInteraction.update();
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context state
        this.ctx.save();
        
        // Apply camera transform
        this.camera.applyTransform(this.ctx);
        
        // Render game world (base map first)
        this.map.render(this.ctx);
        
        // Render player
        this.player.render(this.ctx);
        
        // Render upper layer on top of player (for depth effect)
        this.map.renderUpperLayer(this.ctx);
        
        // Restore context state
        this.ctx.restore();
        
        // Render UI (not affected by camera)
        this.ui.render(this.ctx);
    }
}

/**
 * Input Manager - Handles all input (keyboard, mouse, touch, joystick)
 */
class InputManager {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = { active: false, x: 0, y: 0 };
        this.joystick = {
            active: false,
            center: { x: 0, y: 0 },
            position: { x: 0, y: 0 },
            maxDistance: 60
        };
    }
    
    init() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Mouse events
        this.game.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.game.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.game.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Touch events
        this.game.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.game.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.game.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }
    
    handleKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
        
        // Toggle debug mode with 'D' key
        if (e.key.toLowerCase() === 'd') {
            this.game.debugMode = !this.game.debugMode;
            console.log(`🐛 Debug mode: ${this.game.debugMode ? 'ON' : 'OFF'}`);
        }
        
        e.preventDefault();
    }
    
    handleKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }
    
    handleMouseDown(e) {
        this.mouse.down = true;
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.startJoystick(e.clientX, e.clientY);
    }
    
    handleMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        if (this.mouse.down) {
            this.updateJoystick(e.clientX, e.clientY);
        }
    }
    
    handleMouseUp(e) {
        this.mouse.down = false;
        this.stopJoystick();
    }
    
    handleTouchStart(e) {
            e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.touch.active = true;
            this.touch.x = touch.clientX;
            this.touch.y = touch.clientY;
            this.startJoystick(touch.clientX, touch.clientY);
        }
    }
    
    handleTouchMove(e) {
            e.preventDefault();
        if (this.touch.active && e.touches.length > 0) {
            const touch = e.touches[0];
            this.touch.x = touch.clientX;
            this.touch.y = touch.clientY;
            this.updateJoystick(touch.clientX, touch.clientY);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.touch.active = false;
        this.stopJoystick();
    }
    
    startJoystick(x, y) {
        this.joystick.active = true;
        this.joystick.center.x = x;
        this.joystick.center.y = y;
        this.joystick.position.x = x;
        this.joystick.position.y = y;
    }
    
    updateJoystick(x, y) {
        if (!this.joystick.active) return;
        this.joystick.position.x = x;
        this.joystick.position.y = y;
    }
    
    stopJoystick() {
        this.joystick.active = false;
    }
    
    getMovementInput() {
        let x = 0, y = 0;
        
        // Keyboard input
        if (this.keys['w'] || this.keys['arrowup']) y = -1;
        if (this.keys['s'] || this.keys['arrowdown']) y = 1;
        if (this.keys['a'] || this.keys['arrowleft']) x = -1;
        if (this.keys['d'] || this.keys['arrowright']) x = 1;
        
        // Joystick input
        if (this.joystick.active) {
            const deltaX = this.joystick.position.x - this.joystick.center.x;
            const deltaY = this.joystick.position.y - this.joystick.center.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
            if (distance > 10) { // Dead zone
                const maxDist = this.joystick.maxDistance;
                const clampedDist = Math.min(distance, maxDist);
            const angle = Math.atan2(deltaY, deltaX);
                
                x = Math.cos(angle) * (clampedDist / maxDist);
                y = Math.sin(angle) * (clampedDist / maxDist);
            }
        }
        
        // Normalize diagonal movement
        if (x !== 0 && y !== 0) {
            const length = Math.sqrt(x * x + y * y);
            x /= length;
            y /= length;
        }
        
        return { x, y };
    }
    
    update() {
        // Update input state
    }
}

/**
 * Camera System - Handles viewport and following with zoom and bounds
 */
class Camera {
    constructor(game) {
        this.game = game;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.followSpeed = 0.25;
        this.zoom = 1.2; // Zoom out more for better view
        this.minZoom = 0.6; // Minimum zoom level (60%)
        this.maxZoom = 2.0; // Maximum zoom level
        this.viewport = { width: 0, height: 0 };
        this.bounds = null;
    }
    
    init() {
        this.updateViewport();
        this.x = this.game.player.x;
        this.y = this.game.player.y;
        this.targetX = this.x;
        this.targetY = this.y;
    }
    
    updateViewport() {
        this.viewport.width = this.game.canvas.width;
        this.viewport.height = this.game.canvas.height;
    }
    
    setBounds(x, y, width, height) {
        this.bounds = { x, y, width, height };
    }
    
    update() {
        // Follow player closely
        const playerCenterX = this.game.player.x + this.game.player.width / 2;
        const playerCenterY = this.game.player.y + this.game.player.height / 2;
        
        // Center camera on player (adjusted for zoom)
        this.targetX = playerCenterX - (this.viewport.width / 2) / this.zoom;
        this.targetY = playerCenterY - (this.viewport.height / 2) / this.zoom;
        
        // Smooth interpolation
        this.x += (this.targetX - this.x) * this.followSpeed;
        this.y += (this.targetY - this.y) * this.followSpeed;
        
        // Apply bounds to prevent showing areas outside the map
        if (this.bounds) {
            const zoomedViewportWidth = this.viewport.width / this.zoom;
            const zoomedViewportHeight = this.viewport.height / this.zoom;
            
            // Calculate bounds to keep camera within map
            const minX = this.bounds.x;
            const maxX = this.bounds.x + this.bounds.width - zoomedViewportWidth;
            const minY = this.bounds.y;
            const maxY = this.bounds.y + this.bounds.height - zoomedViewportHeight;
            
            // Clamp camera position to stay within map bounds
            this.x = Math.max(minX, Math.min(maxX, this.x));
            this.y = Math.max(minY, Math.min(maxY, this.y));
        }
    }
    
    applyTransform(ctx) {
        // Apply zoom first
        ctx.scale(this.zoom, this.zoom);
        
        // Then apply translation
        ctx.translate(-this.x, -this.y);
    }
    
    setZoom(zoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }
    
    zoomIn(factor = 0.15) {
        this.setZoom(this.zoom + factor);
    }
    
    zoomOut(factor = 0.15) {
        this.setZoom(this.zoom - factor);
    }
}

/**
 * Map Manager - Handles world map and collision
 */
class MapManager {
    constructor(game) {
        this.game = game;
        this.worldMap = null;
        this.upperLayer = null; // Upper layer for depth effect
        this.collisionLayer = null;
        this.width = 0;
        this.height = 0;
        this.tileWidth = 32;
        this.tileHeight = 32;
        
        // Spatial partitioning for performance
        this.spatialGrid = new Map();
        this.gridSize = 100; // Grid cell size
    }
    
    async loadAssets() {
        console.log('🗺️ Loading map assets...');
        
        // Load world map image
        this.worldMap = await this.loadImage('realisticmap.png');
        
        // Load upper layer for depth effect
        this.upperLayer = await this.loadImage('upper layer.png');
        
        // Load collision data
        await this.loadCollisionData();
        
        console.log('✅ Map assets loaded');
    }
    
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }
    
    async loadCollisionData() {
        try {
            // Load collision data from wallspro.tmj
            const response = await fetch('wallspro.tmj');
            const data = await response.json();
            
            this.collisionLayer = [];
            
            if (data && data.layers) {
                const wallsLayer = data.layers.find(layer => layer.name === 'walls');
                if (wallsLayer && wallsLayer.objects) {
                    this.collisionLayer = wallsLayer.objects.map(obj => {
                        const shape = this.detectShapeType(obj);
                        return {
                            x: obj.x,
                            y: obj.y,
                            width: obj.width,
                            height: obj.height,
                            rotation: obj.rotation || 0,
                            shape: shape,
                            polygon: obj.polygon || null,
                            radius: obj.radius || (shape === 'circle' ? Math.min(obj.width, obj.height) / 2 : null),
                            points: obj.points || null,
                            type: obj.type || 'collision'
                        };
                    });
                }
            }
            
            // Set realistic map dimensions based on wallspro.tmj
            // Map is 1x1 tile with 1037x1613 pixel dimensions
            this.width = data.width || 1; // Single tile width
            this.height = data.height || 1; // Single tile height
            this.tileWidth = data.tilewidth || 1037; // Original tile width
            this.tileHeight = data.tileheight || 1613; // Original tile height
            
            // Set camera bounds to match the realistic map's original ratio
            const mapWidth = this.width * this.tileWidth;
            const mapHeight = this.height * this.tileHeight;
            this.game.camera.setBounds(0, 0, mapWidth, mapHeight);
            
            // Update spatial grid for performance
            this.updateSpatialGrid();
            
            console.log(`📐 Realistic Map: ${this.width}x${this.height} tiles, ${mapWidth}x${mapHeight} pixels`);
            console.log(`🧱 Collision objects: ${this.collisionLayer.length} loaded from wallspro.tmj`);
            console.log(`🎯 Advanced collision system with shape detection enabled`);
            
            // Debug: Count shapes by type
            const shapeCounts = {};
            for (const obj of this.collisionLayer) {
                shapeCounts[obj.shape] = (shapeCounts[obj.shape] || 0) + 1;
            }
            console.log(`📊 Shape distribution:`, shapeCounts);
            
            // Debug: Show polygon details
            const polygons = this.collisionLayer.filter(obj => obj.shape === 'polygon');
            if (polygons.length > 0) {
                console.log(`🔺 Found ${polygons.length} polygon(s):`);
                polygons.forEach((poly, index) => {
                    console.log(`  Polygon ${index + 1}: ${poly.polygon.length} vertices at (${poly.x}, ${poly.y})`);
                    console.log(`    Vertices:`, poly.polygon);
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to load collision data:', error);
            // Fallback to no collision if loading fails
            this.collisionLayer = [];
            this.width = 1;
            this.height = 1;
            this.tileWidth = 1037;
            this.tileHeight = 1613;
        }
    }
    
    checkCollision(x, y, width, height) {
        // Check map boundaries
        const mapWidth = this.width * this.tileWidth;
        const mapHeight = this.height * this.tileHeight;
        
        if (x < 0 || y < 0 || x + width > mapWidth || y + height > mapHeight) {
            return true;
        }
        
        // Get relevant grid cells for performance optimization
        const minGridX = Math.floor(x / this.gridSize);
        const maxGridX = Math.floor((x + width) / this.gridSize);
        const minGridY = Math.floor(y / this.gridSize);
        const maxGridY = Math.floor((y + height) / this.gridSize);
        
        // Debug logging
        if (this.game.debugMode) {
            console.log(`🔍 Checking collision at (${x}, ${y}) size (${width}, ${height})`);
            console.log(`📊 Grid cells: (${minGridX},${minGridY}) to (${maxGridX},${maxGridY})`);
        }
        
        // Check collision only with objects in relevant cells
        for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
            for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
                const key = `${gridX},${gridY}`;
                const cellObjects = this.spatialGrid.get(key) || [];
                
                if (this.game.debugMode && cellObjects.length > 0) {
                    console.log(`🎯 Grid cell (${gridX},${gridY}) has ${cellObjects.length} objects`);
                }
                
                for (const objIndex of cellObjects) {
                    const wall = this.collisionLayer[objIndex];
                    
                    if (this.game.debugMode) {
                        console.log(`🧱 Checking ${wall.shape} object at (${wall.x}, ${wall.y})`);
                    }
                    
                    if (this.checkShapeCollision(x, y, width, height, wall)) {
                        if (this.game.debugMode) {
                            console.log(`🚫 COLLISION DETECTED with ${wall.shape} object!`);
                        }
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    rectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
    
    // Auto-detect shape type from object properties
    detectShapeType(obj) {
        // Check for polygon data first
        if (obj.polygon && Array.isArray(obj.polygon) && obj.polygon.length >= 3) {
            console.log(`🔍 Detected polygon object with ${obj.polygon.length} vertices:`, obj.polygon);
            if (obj.polygon.length === 3) {
                return 'triangle';
            }
            return 'polygon';
        }
        
        // Check for circle (radius or equal width/height)
        if (obj.radius || (obj.width === obj.height && obj.width > 0)) {
            return 'circle';
        }
        
        // Check for rotated rectangle
        if (obj.rotation && obj.rotation !== 0) {
            return 'rectangle'; // Will be handled as rotated rectangle
        }
        
        // Default to rectangle
        return 'rectangle';
    }
    
    // Update spatial grid for performance optimization
    updateSpatialGrid() {
        this.spatialGrid.clear();
        
        for (let i = 0; i < this.collisionLayer.length; i++) {
            const wall = this.collisionLayer[i];
            
            // Calculate bounding box for different shape types
            let minX, minY, maxX, maxY;
            
            if (wall.shape === 'polygon' && wall.polygon && wall.polygon.length > 0) {
                // Calculate bounding box for polygon
                const worldPoints = wall.polygon.map(point => ({
                    x: wall.x + point.x,
                    y: wall.y + point.y
                }));
                
                minX = Math.min(...worldPoints.map(p => p.x));
                minY = Math.min(...worldPoints.map(p => p.y));
                maxX = Math.max(...worldPoints.map(p => p.x));
                maxY = Math.max(...worldPoints.map(p => p.y));
            } else {
                // Use standard bounding box for other shapes
                minX = wall.x;
                minY = wall.y;
                maxX = wall.x + wall.width;
                maxY = wall.y + wall.height;
            }
            
            // Add object to all grid cells it overlaps
            const minGridX = Math.floor(minX / this.gridSize);
            const maxGridX = Math.floor(maxX / this.gridSize);
            const minGridY = Math.floor(minY / this.gridSize);
            const maxGridY = Math.floor(maxY / this.gridSize);
            
            for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
                for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
                    const key = `${gridX},${gridY}`;
                    
                    if (!this.spatialGrid.has(key)) {
                        this.spatialGrid.set(key, []);
                    }
                    this.spatialGrid.get(key).push(i);
                }
            }
        }
        
        console.log(`🗺️ Spatial grid updated with ${this.collisionLayer.length} objects`);
    }
    
    // Shape-specific collision detection
    checkShapeCollision(playerX, playerY, playerWidth, playerHeight, wall) {
        switch (wall.shape) {
            case 'circle':
                return this.checkCircleCollision(playerX, playerY, playerWidth, playerHeight, wall);
            case 'triangle':
                return this.checkTriangleCollision(playerX, playerY, playerWidth, playerHeight, wall);
            case 'polygon':
                return this.checkPolygonCollision(playerX, playerY, playerWidth, playerHeight, wall);
            case 'rectangle':
            default:
                return this.checkRotatedRectangleCollision(playerX, playerY, playerWidth, playerHeight, wall);
        }
    }
    
    // Circle collision detection
    checkCircleCollision(playerX, playerY, playerWidth, playerHeight, circle) {
        // Get circle center and radius
        const circleCenterX = circle.x + (circle.radius || circle.width / 2);
        const circleCenterY = circle.y + (circle.radius || circle.height / 2);
        const radius = circle.radius || Math.min(circle.width, circle.height) / 2;
        
        // Get player center
        const playerCenterX = playerX + playerWidth / 2;
        const playerCenterY = playerY + playerHeight / 2;
        
        // Calculate distance between centers
        const dx = playerCenterX - circleCenterX;
        const dy = playerCenterY - circleCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if distance is less than radius + player radius
        const playerRadius = Math.min(playerWidth, playerHeight) / 2;
        return distance < (radius + playerRadius);
    }
    
    // Triangle collision detection
    checkTriangleCollision(playerX, playerY, playerWidth, playerHeight, triangle) {
        // Define triangle points (assuming equilateral triangle)
        const points = triangle.points || [
            { x: triangle.x + triangle.width / 2, y: triangle.y }, // Top
            { x: triangle.x, y: triangle.y + triangle.height }, // Bottom left
            { x: triangle.x + triangle.width, y: triangle.y + triangle.height } // Bottom right
        ];
        
        // Check if any corner of player rectangle is inside triangle
        const playerCorners = [
            { x: playerX, y: playerY },
            { x: playerX + playerWidth, y: playerY },
            { x: playerX, y: playerY + playerHeight },
            { x: playerX + playerWidth, y: playerY + playerHeight }
        ];
        
        for (const corner of playerCorners) {
            if (this.pointInTriangle(corner, points[0], points[1], points[2])) {
                return true;
            }
        }
        
        // Check if any triangle point is inside player rectangle
        for (const point of points) {
            if (point.x >= playerX && point.x <= playerX + playerWidth &&
                point.y >= playerY && point.y <= playerY + playerHeight) {
                return true;
            }
        }
        
        return false;
    }
    
    // Helper function to check if point is inside triangle
    pointInTriangle(point, a, b, c) {
        const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        const alpha = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denom;
        const beta = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denom;
        const gamma = 1 - alpha - beta;
        
        return alpha >= 0 && beta >= 0 && gamma >= 0;
    }
    
    // Rotated rectangle collision detection
    checkRotatedRectangleCollision(playerX, playerY, playerWidth, playerHeight, wall) {
        if (wall.rotation === 0) {
            // Use simple rectangle collision for non-rotated rectangles
            return this.rectCollision(playerX, playerY, playerWidth, playerHeight, 
                                     wall.x, wall.y, wall.width, wall.height);
        }
        
        // For rotated rectangles, use Separating Axis Theorem (SAT)
        const playerCorners = this.getRotatedCorners(playerX, playerY, playerWidth, playerHeight, 0);
        const wallCorners = this.getRotatedCorners(wall.x, wall.y, wall.width, wall.height, wall.rotation);
        
        return this.satCollision(playerCorners, wallCorners);
    }
    
    // Get corners of rotated rectangle
    getRotatedCorners(x, y, width, height, rotation) {
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const corners = [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: height },
            { x: 0, y: height }
        ];
        
        return corners.map(corner => ({
            x: x + corner.x * cos - corner.y * sin,
            y: y + corner.x * sin + corner.y * cos
        }));
    }
    
    // Separating Axis Theorem collision detection
    satCollision(shape1, shape2) {
        const shapes = [shape1, shape2];
        
        for (let shape = 0; shape < 2; shape++) {
            const currentShape = shapes[shape];
            const otherShape = shapes[1 - shape];
            
            for (let i = 0; i < currentShape.length; i++) {
                const p1 = currentShape[i];
                const p2 = currentShape[(i + 1) % currentShape.length];
                
                const axis = { x: p2.y - p1.y, y: p1.x - p2.x };
                const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
                axis.x /= length;
                axis.y /= length;
                
                const projection1 = this.projectShape(currentShape, axis);
                const projection2 = this.projectShape(otherShape, axis);
                
                if (!this.overlap(projection1, projection2)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // Project shape onto axis
    projectShape(shape, axis) {
        let min = Infinity;
        let max = -Infinity;
        
        for (const point of shape) {
            const dot = point.x * axis.x + point.y * axis.y;
            min = Math.min(min, dot);
            max = Math.max(max, dot);
        }
        
        return { min, max };
    }
    
    // Check if two projections overlap
    overlap(proj1, proj2) {
        return proj1.max >= proj2.min && proj2.max >= proj1.min;
    }
    
    // Enhanced polygon collision detection
    checkPolygonCollision(playerX, playerY, playerWidth, playerHeight, polygon) {
        if (!polygon.polygon || !Array.isArray(polygon.polygon) || polygon.polygon.length < 3) {
            console.log('⚠️ Invalid polygon data:', polygon);
            return false;
        }
        
        // Convert polygon points to world coordinates
        const worldPoints = polygon.polygon.map(point => ({
            x: polygon.x + point.x,
            y: polygon.y + point.y
        }));
        
        if (this.game.debugMode) {
            console.log(`🎯 Checking polygon collision with ${worldPoints.length} vertices:`, worldPoints);
            console.log(`👤 Player at (${playerX}, ${playerY}) size (${playerWidth}, ${playerHeight})`);
        }
        
        // Check if any player corner is inside polygon
        const playerCorners = [
            { x: playerX, y: playerY },
            { x: playerX + playerWidth, y: playerY },
            { x: playerX, y: playerY + playerHeight },
            { x: playerX + playerWidth, y: playerY + playerHeight }
        ];
        
        for (const corner of playerCorners) {
            if (this.pointInPolygon(corner, worldPoints)) {
                if (this.game.debugMode) {
                    console.log(`🚫 Player corner collision detected at (${corner.x}, ${corner.y})`);
                }
                return true;
            }
        }
        
        // Check if any polygon point is inside player rectangle
        for (const point of worldPoints) {
            if (point.x >= playerX && point.x <= playerX + playerWidth &&
                point.y >= playerY && point.y <= playerY + playerHeight) {
                if (this.game.debugMode) {
                    console.log(`🚫 Polygon point collision detected at (${point.x}, ${point.y})`);
                }
                return true;
            }
        }
        
        // Check for edge intersections between player rectangle and polygon
        if (this.rectanglePolygonIntersection(playerX, playerY, playerWidth, playerHeight, worldPoints)) {
            if (this.game.debugMode) {
                console.log(`🚫 Rectangle-polygon edge intersection detected`);
            }
            return true;
        }
        
        if (this.game.debugMode) {
            console.log(`✅ No polygon collision detected`);
        }
        
        return false;
    }
    
    // Check for intersections between rectangle edges and polygon edges
    rectanglePolygonIntersection(rectX, rectY, rectWidth, rectHeight, polygonPoints) {
        const rectEdges = [
            // Top edge
            { x1: rectX, y1: rectY, x2: rectX + rectWidth, y2: rectY },
            // Right edge
            { x1: rectX + rectWidth, y1: rectY, x2: rectX + rectWidth, y2: rectY + rectHeight },
            // Bottom edge
            { x1: rectX, y1: rectY + rectHeight, x2: rectX + rectWidth, y2: rectY + rectHeight },
            // Left edge
            { x1: rectX, y1: rectY, x2: rectX, y2: rectY + rectHeight }
        ];
        
        // Check each rectangle edge against each polygon edge
        for (let i = 0; i < polygonPoints.length; i++) {
            const p1 = polygonPoints[i];
            const p2 = polygonPoints[(i + 1) % polygonPoints.length];
            
            for (const rectEdge of rectEdges) {
                if (this.lineIntersection(
                    rectEdge.x1, rectEdge.y1, rectEdge.x2, rectEdge.y2,
                    p1.x, p1.y, p2.x, p2.y
                )) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Check if two line segments intersect
    lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return false; // Lines are parallel
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }
    
    // Point in polygon test using ray casting
    pointInPolygon(point, polygon) {
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
                (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    render(ctx) {
        if (!this.worldMap) return;
        
        // Render world map at correct size using original dimensions
        const mapWidth = this.width * this.tileWidth;
        const mapHeight = this.height * this.tileHeight;
        
        ctx.drawImage(this.worldMap, 0, 0, mapWidth, mapHeight);
        
        // Render collision debug visualization (optional - can be toggled)
        if (this.game.debugMode) {
            this.renderCollisionDebug(ctx);
            // Also render house areas for debugging
            this.renderHouseAreasDebug(ctx);
        }
        
        // Render home alert if there's unread feedback
        if (this.hasUnreadFeedback) {
            this.renderHomeAlert(ctx);
        }
    }
    
    // Render upper layer separately (called after player)
    renderUpperLayer(ctx) {
        if (!this.upperLayer) return;
        
        const mapWidth = this.width * this.tileWidth;
        const mapHeight = this.height * this.tileHeight;
        
        // Render upper layer for depth effect (hides player when behind it)
        ctx.drawImage(this.upperLayer, 0, 0, mapWidth, mapHeight);
    }
    
    // Debug visualization for collision shapes
    renderCollisionDebug(ctx) {
        ctx.save();
        
        for (const wall of this.collisionLayer) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7;
            
            switch (wall.shape) {
                case 'polygon':
                    this.renderPolygonDebug(ctx, wall);
                    break;
                case 'triangle':
                    this.renderTriangleDebug(ctx, wall);
                    break;
                case 'circle':
                    this.renderCircleDebug(ctx, wall);
                    break;
                case 'rectangle':
                    this.renderRectangleDebug(ctx, wall);
                    break;
            }
        }
        
        ctx.restore();
    }
    
    // Render polygon debug visualization
    renderPolygonDebug(ctx, polygon) {
        if (!polygon.polygon || polygon.polygon.length < 3) return;
        
        const worldPoints = polygon.polygon.map(point => ({
            x: polygon.x + point.x,
            y: polygon.y + point.y
        }));
        
        ctx.beginPath();
        ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
        
        for (let i = 1; i < worldPoints.length; i++) {
            ctx.lineTo(worldPoints[i].x, worldPoints[i].y);
        }
        
        ctx.closePath();
        ctx.stroke();
        
        // Fill with semi-transparent color
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fill();
        
        // Draw vertices
        ctx.fillStyle = '#ff0000';
        for (const point of worldPoints) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Render triangle debug visualization
    renderTriangleDebug(ctx, triangle) {
        const points = triangle.points || [
            { x: triangle.x + triangle.width / 2, y: triangle.y },
            { x: triangle.x, y: triangle.y + triangle.height },
            { x: triangle.x + triangle.width, y: triangle.y + triangle.height }
        ];
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.closePath();
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fill();
    }
    
    // Render circle debug visualization
    renderCircleDebug(ctx, circle) {
        const centerX = circle.x + (circle.radius || circle.width / 2);
        const centerY = circle.y + (circle.radius || circle.height / 2);
        const radius = circle.radius || Math.min(circle.width, circle.height) / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fill();
    }
    
    // Render rectangle debug visualization
    renderRectangleDebug(ctx, rectangle) {
        ctx.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    }
    
    renderHomeAlert(ctx) {
        const homeX = 300; // Home position X (adjusted for 1037x1613 map)
        const homeY = 400; // Home position Y (adjusted for 1037x1613 map)
        const alertRadius = 60; // Scaled up for larger map
        const time = Date.now() * 0.003; // Animation time
        
        // Save context state
        ctx.save();
        
        // Set up glowing effect
        const gradient = ctx.createRadialGradient(
            homeX, homeY, 0,
            homeX, homeY, alertRadius
        );
        
        // Create pulsing red glow
        const alpha = 0.3 + 0.2 * Math.sin(time);
        gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        gradient.addColorStop(0.7, `rgba(255, 0, 0, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        // Draw glowing circle
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(homeX, homeY, alertRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw alert icon
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', homeX, homeY);
        
        // Draw pulsing border
        ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + 0.3 * Math.sin(time)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(homeX, homeY, alertRadius - 5, 0, Math.PI * 2);
        ctx.stroke();
        
        // Restore context state
        ctx.restore();
    }
    
    // Debug visualization for house areas
    renderHouseAreasDebug(ctx) {
        if (!this.game.houseInteraction || !this.game.houseInteraction.houseAreas) return;
        
        ctx.save();
        
        for (const house of this.game.houseInteraction.houseAreas) {
            ctx.strokeStyle = '#00ff00'; // Green for house areas
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.7;
            
            switch (house.shape) {
                case 'polygon':
                    this.renderHousePolygonDebug(ctx, house);
                    break;
                case 'ellipse':
                    this.renderHouseEllipseDebug(ctx, house);
                    break;
                case 'rectangle':
                    this.renderHouseRectangleDebug(ctx, house);
                    break;
            }
            
            // Draw house name
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(house.name, house.centerX, house.centerY - 20);
        }
        
        ctx.restore();
    }
    
    renderHousePolygonDebug(ctx, house) {
        if (!house.polygon || house.polygon.length < 3) return;
        
        const worldPoints = house.polygon.map(point => ({
            x: house.x + point.x,
            y: house.y + point.y
        }));
        
        ctx.beginPath();
        ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
        
        for (let i = 1; i < worldPoints.length; i++) {
            ctx.lineTo(worldPoints[i].x, worldPoints[i].y);
        }
        
        ctx.closePath();
        ctx.stroke();
        
        // Fill with semi-transparent color
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fill();
    }
    
    renderHouseEllipseDebug(ctx, house) {
        const centerX = house.x + house.width / 2;
        const centerY = house.y + house.height / 2;
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, house.width / 2, house.height / 2, 0, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fill();
    }
    
    renderHouseRectangleDebug(ctx, house) {
        ctx.strokeRect(house.x, house.y, house.width, house.height);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(house.x, house.y, house.width, house.height);
    }
}

/**
 * Player - Handles player character
 */
class Player {
    constructor(game) {
        this.game = game;
        this.x = 470; // Adjusted for realistic map (1037x1613)
        this.y = 800; // Adjusted for realistic map (1037x1613)
        this.width = 36; // 1.5x bigger (was 24)
        this.height = 46.8; // 1.5x bigger (was 31.2)
        this.speed = 240; // Increased speed for larger map
        this.direction = 'down';
        this.isMoving = false;
        
        // Animation
        this.animationFrame = 0;
        this.animationSpeed = 8; // frames per second
        this.frameCount = 4;
        this.currentFrame = 0;
        
        // Sprite
        this.sprite = null;
        this.spriteWidth = 0;   // Will be calculated from image width / 4
        this.spriteHeight = 0;  // Will be calculated from image height / 4
        this.spriteSheetCols = 4; // Number of columns in sprite sheet
        this.spriteSheetRows = 4; // Number of rows in sprite sheet
        
    }
    
    async loadAssets() {
        console.log('👤 Loading player assets...');
        this.sprite = await this.loadImage('assets/player sprite sheet.png');
        
        // Calculate sprite dimensions from actual image size
        this.spriteWidth = this.sprite.width / this.spriteSheetCols;
        this.spriteHeight = this.sprite.height / this.spriteSheetRows;
        
        console.log('✅ Player assets loaded');
        console.log(`📐 Sprite sheet: ${this.spriteSheetCols}x${this.spriteSheetRows} grid`);
        console.log(`🖼️ Image size: ${this.sprite.width}x${this.sprite.height}px`);
        console.log(`🎬 Frame size: ${this.spriteWidth}x${this.spriteHeight}px`);
        console.log(`🎯 Total frames: ${this.spriteSheetCols * this.spriteSheetRows}`);
    }
    
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }
    
    update(deltaTime) {
        // Get movement input
        const input = this.game.input.getMovementInput();
        
        // Update movement
        this.isMoving = input.x !== 0 || input.y !== 0;
        
        if (this.isMoving) {
            // Close quest panel when player starts moving
            if (this.game.ui && this.game.ui.elements.questPanel && this.game.ui.elements.questPanel.classList.contains('open')) {
                this.game.ui.closeQuestPanel();
            }
            
            // Close settings dropdown when player starts moving
            if (this.game.ui && this.game.ui.closeSettingsDropdown) {
                const settingsDropdown = document.getElementById('settings-dropdown');
                if (settingsDropdown && settingsDropdown.style.display === 'block') {
                    this.game.ui.closeSettingsDropdown();
                }
            }
            
            // Update direction
            if (Math.abs(input.x) > Math.abs(input.y)) {
                this.direction = input.x > 0 ? 'right' : 'left';
            } else {
                this.direction = input.y > 0 ? 'down' : 'up';
            }
            
            // Calculate movement
            const moveX = input.x * this.speed * deltaTime / 1000;
            const moveY = input.y * this.speed * deltaTime / 1000;
            
            // Apply movement with collision detection
            this.move(moveX, moveY);
            
        }
        
        // Update animation
        this.updateAnimation(deltaTime);
    }
    
    move(deltaX, deltaY) {
        // Test horizontal movement
        if (deltaX !== 0) {
            const newX = this.x + deltaX;
            if (!this.game.map.checkCollision(newX, this.y, this.width, this.height)) {
                this.x = newX;
            }
        }
        
        // Test vertical movement
        if (deltaY !== 0) {
            const newY = this.y + deltaY;
            if (!this.game.map.checkCollision(this.x, newY, this.width, this.height)) {
                this.y = newY;
            }
        }
    }
    
    updateAnimation(deltaTime) {
        if (this.isMoving) {
            this.animationFrame += this.animationSpeed * deltaTime / 1000;
            if (this.animationFrame >= this.frameCount) {
                this.animationFrame = 0;
            }
        } else {
            this.animationFrame = 0;
        }
        this.currentFrame = Math.floor(this.animationFrame);
    }
    
    render(ctx) {
        if (!this.sprite) {
            // Draw debug rectangle
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            return;
        }
        
        // Get sprite frame coordinates
        const spriteX = this.currentFrame * this.spriteWidth;
        const spriteY = this.getDirectionY() * this.spriteHeight;
        
        // Debug info (uncomment for troubleshooting)
        // console.log(`Direction: ${this.direction}, Frame: ${this.currentFrame}, Sprite coords: (${spriteX}, ${spriteY})`);
        
        // Draw player sprite
        ctx.drawImage(
            this.sprite,
            spriteX, spriteY, this.spriteWidth, this.spriteHeight,
            this.x, this.y, this.width, this.height
        );
    }
    
    getDirectionY() {
        // For a 4x4 sprite sheet, each direction has 4 animation frames
        // Row 0: Down, Row 1: Right, Row 2: Left, Row 3: Up
        switch (this.direction) {
            case 'down': return 0;  // First row (frames 0-3)
            case 'right': return 1; // Second row (frames 0-3)
            case 'left': return 2;  // Third row (frames 0-3)
            case 'up': return 3;    // Fourth row (frames 0-3)
            default: return 0;
        }
    }
}

/**
 * UI Manager - Handles all user interface
 */
class UIManager {
    constructor(game) {
        this.game = game;
        this.elements = {};
        this.getElements();
    }
    
    getElements() {
        this.elements = {
            loginScreen: document.getElementById('loginScreen'),
            loadingScreen: document.getElementById('loadingScreen'),
            gameContainer: document.getElementById('gameContainer'),
            loginForm: document.getElementById('loginForm'),
            emailInput: document.getElementById('emailInput'),
            passwordInput: document.getElementById('passwordInput'),
            loginButton: document.getElementById('loginButton'),
            loginButtonText: document.getElementById('loginButtonText'),
            loginSpinner: document.getElementById('loginSpinner'),
            loginError: document.getElementById('loginError'),
            logoutButton: document.getElementById('logoutButton'),
            userName: document.getElementById('userName'),
            userLevel: document.getElementById('userLevel'),
            userPoints: document.getElementById('userPoints'),
            playerName: document.getElementById('playerName'),
            playerAvatar: document.getElementById('playerAvatar'),
            questToggle: document.getElementById('questToggle'),
            questPanel: document.getElementById('questPanel'),
            settingsButton: document.getElementById('settingsButton')
        };
        
        // Setup quest panel functionality
        this.setupQuestPanel();
        
        // Setup settings button functionality
        this.setupSettingsButton();
    }
    
    setupQuestPanel() {
        // Quest toggle click handler
        if (this.elements.questToggle) {
            this.elements.questToggle.addEventListener('click', async () => {
                await this.toggleQuestPanel();
            });
        }
        
        
        // Quest panel drag functionality
        this.setupQuestPanelDrag();
    }
    
    setupQuestPanelDrag() {
        // Simple click-only functionality - no dragging
        // The click handler is already set up in setupQuestPanel()
    }
    
    async toggleQuestPanel() {
        if (this.elements.questPanel.classList.contains('open')) {
            this.closeQuestPanel();
        } else {
            await this.openQuestPanel();
        }
    }
    
    async openQuestPanel() {
        this.elements.questPanel.classList.add('open');
        this.elements.questToggle.classList.add('open');
        
        // Mark all current quests as seen in database when panel is opened
        await this.markQuestsAsSeen();
        
        // Hide notification badge when panel is opened
        const notificationBadge = document.getElementById('questNotificationBadge');
        if (notificationBadge) {
            notificationBadge.style.display = 'none';
        }
        
        // Save quest panel state to database
        await this.saveQuestPanelState(true);
        
        console.log('📋 Quest panel pulled out from left side');
    }
    
    async closeQuestPanel() {
        this.elements.questPanel.classList.remove('open');
        this.elements.questToggle.classList.remove('open');
        
        // Save quest panel state to database
        await this.saveQuestPanelState(false);
        
        console.log('📋 Quest panel pushed back behind arrow');
        
        // Re-check notification status when panel closes
        // This will be handled by updateQuestNotification when quests are loaded
        // Trigger a quest reload check if needed
        if (this.game?.auth?.loadPlayerQuests) {
            // Small delay to ensure panel is closed before checking
            setTimeout(() => {
                this.game.auth.loadPlayerQuests();
            }, 100);
        }
    }
    
    async saveQuestPanelState(isOpen) {
        if (!this.game?.auth?.userStats || !window.db) return;
        
        try {
            // Update userStats
            this.game.auth.userStats.questPanelOpen = isOpen;
            
            // Save to database
            await this.game.auth.saveUserStats();
            
            console.log(`💾 Quest panel state saved: ${isOpen ? 'open' : 'closed'}`);
        } catch (error) {
            console.error('❌ Error saving quest panel state:', error);
        }
    }
    
    restoreQuestPanelState() {
        if (!this.game?.auth?.userStats) return;
        
        const isOpen = this.game.auth.userStats.questPanelOpen === true;
        
        if (isOpen) {
            // Restore open state
            this.elements.questPanel.classList.add('open');
            this.elements.questToggle.classList.add('open');
            console.log('📋 Quest panel state restored: open');
        } else {
            // Ensure closed state
            this.elements.questPanel.classList.remove('open');
            this.elements.questToggle.classList.remove('open');
            console.log('📋 Quest panel state restored: closed');
        }
    }
    
    setupSettingsButton() {
        // Settings button click handler
        if (this.elements.settingsButton) {
            this.elements.settingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSettingsDropdown();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.settings-dropdown') && !e.target.closest('.settings-btn')) {
                this.closeSettingsDropdown();
            }
        });
    }
    
    toggleSettingsDropdown() {
        let dropdown = document.getElementById('settings-dropdown');
        if (!dropdown) {
            this.createSettingsDropdown();
        } else {
            if (dropdown.style.display === 'block') {
                this.closeSettingsDropdown();
            } else {
                // Update zoom slider and display with current values before showing
                this.updateZoomSlider();
                this.showSettingsDropdown();
            }
        }
    }
    
    updateZoomSlider() {
        const dropdown = document.getElementById('settings-dropdown');
        if (!dropdown || !this.game || !this.game.camera) return;
        
        const zoomSlider = dropdown.querySelector('#zoomSlider');
        const zoomLevelDisplay = dropdown.querySelector('#zoomLevelDisplay');
        
        if (zoomSlider) {
            const currentZoom = this.game.camera.zoom;
            zoomSlider.value = currentZoom;
            if (zoomLevelDisplay) {
                zoomLevelDisplay.textContent = (currentZoom * 100).toFixed(0) + '%';
            }
        }
    }
    
    createSettingsDropdown() {
        const dropdown = document.createElement('div');
        dropdown.id = 'settings-dropdown';
        dropdown.className = 'settings-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 8px;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(20px);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            min-width: 180px;
            z-index: 1000;
            display: none;
            overflow: hidden;
        `;
        
        // Get current zoom level
        const currentZoom = this.game && this.game.camera ? this.game.camera.zoom : 1.2;
        const minZoom = this.game && this.game.camera ? this.game.camera.minZoom : 0.5;
        const maxZoom = this.game && this.game.camera ? this.game.camera.maxZoom : 2.0;
        
        dropdown.innerHTML = `
            <div class="settings-zoom-section">
                <div class="settings-zoom-header">
                    <div class="settings-item-icon">🔍</div>
                    <div class="settings-item-text">
                        <div class="settings-item-title">Zoom Level</div>
                        <div class="settings-item-subtitle" id="zoomLevelDisplay">${(currentZoom * 100).toFixed(0)}%</div>
                    </div>
                </div>
                <div class="settings-zoom-controls">
                    <input type="range" id="zoomSlider" 
                           min="${minZoom}" 
                           max="${maxZoom}" 
                           step="0.05" 
                           value="${currentZoom}"
                           class="zoom-slider">
                    <div class="zoom-labels">
                        <span class="zoom-label">${(minZoom * 100).toFixed(0)}%</span>
                        <span class="zoom-label">${(maxZoom * 100).toFixed(0)}%</span>
                    </div>
                </div>
            </div>
            <div class="settings-dropdown-item" data-action="profile">
                <div class="settings-item-icon">👤</div>
                <div class="settings-item-text">
                    <div class="settings-item-title">Profile</div>
                    <div class="settings-item-subtitle">View your profile</div>
                </div>
            </div>
            <div class="settings-dropdown-item" data-action="logout">
                <div class="settings-item-icon">🚪</div>
                <div class="settings-item-text">
                    <div class="settings-item-title">Logout</div>
                    <div class="settings-item-subtitle">Sign out of your account</div>
                </div>
            </div>
        `;
        
        // Add CSS styles for dropdown items
        const style = document.createElement('style');
        style.textContent = `
            .settings-dropdown-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                cursor: pointer;
                transition: background-color 0.2s ease;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .settings-dropdown-item:last-child {
                border-bottom: none;
            }
            
            .settings-dropdown-item:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .settings-item-icon {
                font-size: 18px;
                width: 24px;
                text-align: center;
            }
            
            .settings-item-text {
                flex: 1;
            }
            
            .settings-item-title {
                color: #fff;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 2px;
            }
            
            .settings-item-subtitle {
                color: rgba(255, 255, 255, 0.7);
                font-size: 12px;
            }
            
            .settings-zoom-section {
                padding: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .settings-zoom-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }
            
            .settings-zoom-controls {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .zoom-slider {
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: rgba(255, 255, 255, 0.2);
                outline: none;
                -webkit-appearance: none;
                appearance: none;
                cursor: pointer;
            }
            
            .zoom-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #fff;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                transition: all 0.2s ease;
            }
            
            .zoom-slider::-webkit-slider-thumb:hover {
                transform: scale(1.1);
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
            }
            
            .zoom-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #fff;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                transition: all 0.2s ease;
            }
            
            .zoom-slider::-moz-range-thumb:hover {
                transform: scale(1.1);
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
            }
            
            .zoom-labels {
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 4px;
            }
            
            .zoom-label {
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
        
        // Position the dropdown relative to the settings button
        const settingsButton = this.elements.settingsButton;
        settingsButton.style.position = 'relative';
        settingsButton.appendChild(dropdown);
        
        // Add zoom slider handler
        const zoomSlider = dropdown.querySelector('#zoomSlider');
        const zoomLevelDisplay = dropdown.querySelector('#zoomLevelDisplay');
        
        if (zoomSlider && this.game && this.game.camera) {
            // Update zoom on slider change
            zoomSlider.addEventListener('input', (e) => {
                const zoomValue = parseFloat(e.target.value);
                if (this.game && this.game.camera) {
                    this.game.camera.setZoom(zoomValue);
                    if (zoomLevelDisplay) {
                        zoomLevelDisplay.textContent = (zoomValue * 100).toFixed(0) + '%';
                    }
                    // Save zoom level immediately
                    this.saveZoomLevel();
                }
            });
            
            // Also update on mouse move for smooth preview
            zoomSlider.addEventListener('mousemove', (e) => {
                if (e.buttons === 1) { // Only if mouse is pressed
                    const zoomValue = parseFloat(e.target.value);
                    if (this.game && this.game.camera) {
                        this.game.camera.setZoom(zoomValue);
                        if (zoomLevelDisplay) {
                            zoomLevelDisplay.textContent = (zoomValue * 100).toFixed(0) + '%';
                        }
                    }
                }
            });
        }
        
        // Add click handlers for dropdown items
        dropdown.querySelectorAll('.settings-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                this.handleSettingsAction(action);
                this.closeSettingsDropdown();
            });
        });
        
        this.showSettingsDropdown();
    }
    
    showSettingsDropdown() {
        const dropdown = document.getElementById('settings-dropdown');
        if (dropdown) {
            dropdown.style.display = 'block';
        }
    }
    
    closeSettingsDropdown() {
        const dropdown = document.getElementById('settings-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    handleSettingsAction(action) {
        switch (action) {
            case 'profile':
                this.showProfileModal();
                break;
            case 'logout':
                this.handleLogout();
                break;
            default:
                console.log('Unknown settings action:', action);
        }
    }
    
    saveZoomLevel() {
        if (this.game && this.game.camera) {
            try {
                localStorage.setItem('gameZoomLevel', this.game.camera.zoom.toString());
            } catch (error) {
                console.warn('Could not save zoom level to localStorage:', error);
            }
        }
    }
    
    loadZoomLevel() {
        if (this.game && this.game.camera) {
            try {
                const savedZoom = localStorage.getItem('gameZoomLevel');
                if (savedZoom) {
                    const zoom = parseFloat(savedZoom);
                    if (!isNaN(zoom) && zoom >= this.game.camera.minZoom && zoom <= this.game.camera.maxZoom) {
                        this.game.camera.setZoom(zoom);
                        console.log('🔍 Loaded saved zoom level:', zoom);
                    }
                }
            } catch (error) {
                console.warn('Could not load zoom level from localStorage:', error);
            }
        }
    }
    
    
    showProfileModal() {
        // Create profile modal
        let profileModal = document.getElementById('profile-modal');
        if (!profileModal) {
            profileModal = document.createElement('div');
            profileModal.id = 'profile-modal';
            profileModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 20px;
                max-width: 700px;
                width: 90%;
                max-height: 85vh;
                overflow-y: auto;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                position: relative;
                text-align: left;
            `;
            
            modalContent.innerHTML = `
                <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px;">👤 Player Profile</h2>
                
                <!-- Profile Header -->
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px; padding: 20px; background: rgba(0, 0, 0, 0.05); border-radius: 15px;">
                    <div style="position: relative;">
                        <div style="width: 100px; height: 100px; background: linear-gradient(135deg, #4CAF50, #2196F3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; color: white; box-shadow: 0 8px 25px rgba(76, 175, 80, 0.3);">
                            <img id="profilePicture" src="" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: none;">
                            <span id="profileInitials" style="font-weight: 700;">👤</span>
                        </div>
                    </div>
                    
                    <div style="flex: 1;">
                        <h3 id="profileName" style="margin: 0 0 8px 0; color: #1d1d1f; font-size: 22px; font-weight: 600;">Player Name</h3>
                        <p id="profileEmail" style="margin: 0 0 10px 0; color: #666; font-size: 14px;">user@example.com</p>
                        <div id="profileStatus" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(76, 175, 80, 0.1); color: #4CAF50; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid rgba(76, 175, 80, 0.2);">
                            <span>🟢</span>
                            <span>Online</span>
                        </div>
                    </div>
                </div>
                
                <!-- Main Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05)); padding: 20px; border-radius: 15px; text-align: center; border: 1px solid rgba(76, 175, 80, 0.2);">
                        <div style="color: #4CAF50; font-size: 16px; font-weight: 600; margin-bottom: 8px;">🎯 Level</div>
                        <div id="profileLevel" style="color: #1d1d1f; font-size: 28px; font-weight: 700;">1</div>
                        <div id="levelProgress" style="margin-top: 8px; background: rgba(0, 0, 0, 0.1); height: 4px; border-radius: 2px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #4CAF50, #8BC34A); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05)); padding: 20px; border-radius: 15px; text-align: center; border: 1px solid rgba(255, 215, 0, 0.2);">
                        <div style="color: #FFD700; font-size: 16px; font-weight: 600; margin-bottom: 8px;">💰 Coins</div>
                        <div id="profileCoins" style="color: #1d1d1f; font-size: 28px; font-weight: 700;">0 DZD</div>
                        <div style="color: #666; font-size: 12px; margin-top: 4px;">Total Earned</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05)); padding: 20px; border-radius: 15px; text-align: center; border: 1px solid rgba(33, 150, 243, 0.2);">
                        <div style="color: #2196F3; font-size: 16px; font-weight: 600; margin-bottom: 8px;">⭐ Experience</div>
                        <div id="profileExp" style="color: #1d1d1f; font-size: 28px; font-weight: 700;">0</div>
                        <div id="expToNext" style="color: #666; font-size: 12px; margin-top: 4px;">0 to next level</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, rgba(156, 39, 176, 0.1), rgba(156, 39, 176, 0.05)); padding: 20px; border-radius: 15px; text-align: center; border: 1px solid rgba(156, 39, 176, 0.2);">
                        <div style="color: #9C27B0; font-size: 16px; font-weight: 600; margin-bottom: 8px;">🏆 Quests</div>
                        <div id="profileQuests" style="color: #1d1d1f; font-size: 28px; font-weight: 700;">0</div>
                        <div style="color: #666; font-size: 12px; margin-top: 4px;">Completed</div>
                    </div>
                </div>
                
                <!-- Detailed Analytics -->
                <div style="background: rgba(0, 0, 0, 0.05); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(0, 0, 0, 0.1);">
                    <h4 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                        📊 Account Analytics
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                        <div style="background: rgba(255, 255, 255, 0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);">
                            <div style="color: #FF9800; font-size: 14px; font-weight: 600; margin-bottom: 5px;">🎮 Games Played</div>
                            <div id="gamesPlayed" style="color: #1d1d1f; font-size: 20px; font-weight: 700;">0</div>
                        </div>
                        
                        <div style="background: rgba(255, 255, 255, 0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);">
                            <div style="color: #E91E63; font-size: 14px; font-weight: 600; margin-bottom: 5px;">⏱️ Play Time</div>
                            <div id="playTime" style="color: #1d1d1f; font-size: 20px; font-weight: 700;">0h 0m</div>
                        </div>
                        
                        <div style="background: rgba(255, 255, 255, 0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);">
                            <div style="color: #00BCD4; font-size: 14px; font-weight: 600; margin-bottom: 5px;">🏅 Achievements</div>
                            <div id="achievements" style="color: #1d1d1f; font-size: 20px; font-weight: 700;">0</div>
                        </div>
                        
                        <div style="background: rgba(255, 255, 255, 0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);">
                            <div style="color: #4CAF50; font-size: 14px; font-weight: 600; margin-bottom: 5px;">📅 Member Since</div>
                            <div id="memberSince" style="color: #1d1d1f; font-size: 16px; font-weight: 600;">Today</div>
                        </div>
                        
                        <div style="background: rgba(255, 255, 255, 0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);">
                            <div style="color: #9C27B0; font-size: 14px; font-weight: 600; margin-bottom: 5px;">🎯 Win Rate</div>
                            <div id="winRate" style="color: #1d1d1f; font-size: 20px; font-weight: 700;">0%</div>
                        </div>
                        
                        <div style="background: rgba(255, 255, 255, 0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);">
                            <div style="color: #FF5722; font-size: 14px; font-weight: 600; margin-bottom: 5px;">🔥 Streak</div>
                            <div id="currentStreak" style="color: #1d1d1f; font-size: 20px; font-weight: 700;">0 days</div>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Activity -->
                <div style="background: rgba(0, 0, 0, 0.05); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(0, 0, 0, 0.1);">
                    <h4 style="margin: 0 0 15px 0; color: #1d1d1f; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                        📈 Recent Activity
                    </h4>
                    <div id="recentActivity" style="color: #666; font-size: 14px; line-height: 1.6;">
                        <div>• Welcome to the game!</div>
                        <div>• Profile created successfully</div>
                        <div>• Ready to start your journey</div>
                    </div>
                </div>
                
                <button id="closeProfileModal" style="
                    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">Close</button>
                
                <button id="closeProfileModalX" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                ">×</button>
            `;
            
            profileModal.appendChild(modalContent);
            document.body.appendChild(profileModal);
            
            // Add event listeners
            document.getElementById('closeProfileModal').addEventListener('click', () => {
                this.closeProfileModal();
            });
            
            document.getElementById('closeProfileModalX').addEventListener('click', () => {
                this.closeProfileModal();
            });
            
            profileModal.addEventListener('click', (e) => {
                if (e.target === profileModal) {
                    this.closeProfileModal();
                }
            });
        }
        
        // Update profile information with real-time data
        this.updateProfileInfo();
        
        // Set up real-time updates every 2 seconds while modal is open
        this.profileUpdateInterval = setInterval(() => {
            this.updateProfileInfo();
        }, 2000);
        
        profileModal.style.display = 'flex';
    }
    
    closeProfileModal() {
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) {
            profileModal.style.display = 'none';
        }
        
        // Clear the update interval
        if (this.profileUpdateInterval) {
            clearInterval(this.profileUpdateInterval);
            this.profileUpdateInterval = null;
        }
    }
    
    async updateProfileInfo() {
        // Get the actual game data from the UI elements and game state
        let user = null;
        let stats = null;
        
        // Get current values from the actual game UI elements
        const currentLevel = this.elements?.userLevel?.textContent || '1';
        const currentCoins = this.elements?.userPoints?.textContent || '0';
        
        // Try to get user from Firebase auth first (most reliable)
        if (window.firebase && window.firebase.auth) {
            try {
                const currentUser = window.firebase.auth().currentUser;
                if (currentUser) {
                    user = {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        displayName: currentUser.displayName,
                        photoURL: currentUser.photoURL,
                        emailVerified: currentUser.emailVerified,
                        createdAt: currentUser.metadata?.creationTime,
                        lastSignIn: currentUser.metadata?.lastSignInTime
                    };
                    console.log('🔥 Firebase user data:', user);
                }
            } catch (error) {
                console.error('❌ Error getting Firebase user:', error);
            }
        }
        
        // Try to get user from game auth
        if (!user && this.game && this.game.auth) {
            user = this.game.auth.user;
            stats = this.game.auth.userStats;
        }
        
        // Try to get user from window auth
        if (!user && window.auth && window.auth.user) {
            user = window.auth.user;
        }
        
        // Get user data from localStorage as fallback
        const savedUserData = JSON.parse(localStorage.getItem('userData') || '{}');
        const savedStats = JSON.parse(localStorage.getItem('userStats') || '{}');
        
        // Use actual game data if available, otherwise use stored data
        const actualStats = {
            level: parseInt(currentLevel) || 1,
            points: parseInt(currentCoins) || 0,
            experience: stats?.experience || savedStats?.experience || 0,
            gamesPlayed: 0,
            totalPlayTime: 0,
            achievements: 0,
            wins: 0,
            losses: 0,
            currentStreak: 0,
            questsCompleted: 0,
            ...savedStats,
            ...stats
        };
        
        const finalStats = actualStats;
        const finalUser = { ...savedUserData, ...user };
        
        // Update profile elements
        const nameEl = document.getElementById('profileName');
        const emailEl = document.getElementById('profileEmail');
        const levelEl = document.getElementById('profileLevel');
        const coinsEl = document.getElementById('profileCoins');
        const expEl = document.getElementById('profileExp');
        const questsEl = document.getElementById('profileQuests');
        const gamesPlayedEl = document.getElementById('gamesPlayed');
        const playTimeEl = document.getElementById('playTime');
        const achievementsEl = document.getElementById('achievements');
        const memberSinceEl = document.getElementById('memberSince');
        const winRateEl = document.getElementById('winRate');
        const currentStreakEl = document.getElementById('currentStreak');
        const expToNextEl = document.getElementById('expToNext');
        const levelProgressEl = document.getElementById('levelProgress');
        const profilePictureEl = document.getElementById('profilePicture');
        const profileInitialsEl = document.getElementById('profileInitials');
        
        // Basic profile info - prioritize Firebase data
        if (nameEl) {
            let displayName = 'Player';
            
            // Try Firebase displayName first
            if (finalUser?.displayName) {
                displayName = finalUser.displayName;
            } else if (finalUser?.email) {
                // Use email username if no display name
                displayName = finalUser.email.split('@')[0];
            }
            
            nameEl.textContent = displayName;
            
            // Set initials for avatar
            if (profileInitialsEl) {
                const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                profileInitialsEl.textContent = initials || '👤';
            }
        }
        
        if (emailEl) {
            emailEl.textContent = finalUser?.email || 'No email available';
        }
        
        // Profile picture - handle Firebase photoURL
        if (profilePictureEl) {
            if (finalUser?.photoURL) {
                // Load Firebase profile picture
                profilePictureEl.src = finalUser.photoURL;
                profilePictureEl.style.display = 'block';
                if (profileInitialsEl) profileInitialsEl.style.display = 'none';
                
                // Handle image load errors
                profilePictureEl.onerror = () => {
                    console.log('🖼️ Profile picture failed to load, showing initials');
                    profilePictureEl.style.display = 'none';
                    if (profileInitialsEl) profileInitialsEl.style.display = 'block';
                };
                
                // Handle successful image load
                profilePictureEl.onload = () => {
                    console.log('🖼️ Profile picture loaded successfully');
                };
            } else {
                // No profile picture, show initials
                profilePictureEl.style.display = 'none';
                if (profileInitialsEl) profileInitialsEl.style.display = 'block';
            }
        }
        
        // Main stats
        const level = finalStats?.level || 1;
        const experience = finalStats?.experience || 0;
        const coins = finalStats?.points || 0;
        const quests = finalStats?.questsCompleted || 0;
        
        if (levelEl) {
            levelEl.textContent = level;
        }
        
        if (coinsEl) {
            coinsEl.textContent = `${coins.toLocaleString()} DZD`;
        }
        
        if (expEl) {
            expEl.textContent = experience.toLocaleString();
        }
        
        if (questsEl) {
            questsEl.textContent = quests;
        }
        
        // Level progress - correct XP system: Level 1 needs 100 XP, Level 2 needs 200 XP, etc.
        const expForNextLevel = level * 100; // Level 1: 100 XP, Level 2: 200 XP, Level 3: 300 XP, etc.
        const currentLevelExp = experience % expForNextLevel;
        const progressPercent = (currentLevelExp / expForNextLevel) * 100;
        
        if (expToNextEl) {
            expToNextEl.textContent = `${(expForNextLevel - currentLevelExp).toLocaleString()} to next level`;
        }
        
        if (levelProgressEl) {
            const progressBar = levelProgressEl.querySelector('div');
            if (progressBar) {
                progressBar.style.width = `${Math.min(progressPercent, 100)}%`;
            }
        }
        
        // Analytics - calculate realistic values based on level and experience
        // With correct XP system: Level 1=100XP, Level 2=200XP, Level 3=300XP, etc.
        const totalXPNeeded = (level * (level + 1) / 2) * 100; // Sum of XP needed for all levels
        const gamesPlayed = Math.max(finalStats?.gamesPlayed || 0, Math.floor(level * 3)); // 3 games per level
        const playTimeMinutes = Math.max(finalStats?.playTimeMinutes || 0, Math.floor(level * 30)); // 30 minutes per level
        const achievements = Math.max(finalStats?.achievements || 0, Math.floor(level / 2));
        const memberSince = finalUser?.createdAt || new Date().toISOString();
        const wins = Math.max(finalStats?.wins || 0, Math.floor(gamesPlayed * 0.7)); // 70% win rate
        const losses = Math.max(finalStats?.losses || 0, gamesPlayed - wins);
        const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
        const currentStreak = Math.max(finalStats?.currentStreak || 0, Math.floor(level / 3));
        
        if (gamesPlayedEl) {
            gamesPlayedEl.textContent = gamesPlayed.toLocaleString();
        }
        
        if (playTimeEl) {
            const hours = Math.floor(playTimeMinutes / 60);
            const minutes = playTimeMinutes % 60;
            playTimeEl.textContent = `${hours}h ${minutes}m`;
        }
        
        if (achievementsEl) {
            achievementsEl.textContent = achievements;
        }
        
        if (memberSinceEl) {
            // Use Firebase creation time if available, otherwise use stored data
            const creationTime = finalUser?.createdAt || finalUser?.lastSignIn || memberSince;
            const date = new Date(creationTime);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                memberSinceEl.textContent = 'Today';
            } else if (diffDays < 7) {
                memberSinceEl.textContent = `${diffDays} days ago`;
            } else if (diffDays < 30) {
                memberSinceEl.textContent = `${Math.floor(diffDays / 7)} weeks ago`;
            } else if (diffDays < 365) {
                memberSinceEl.textContent = `${Math.floor(diffDays / 30)} months ago`;
            } else {
                memberSinceEl.textContent = date.toLocaleDateString();
            }
        }
        
        if (winRateEl) {
            winRateEl.textContent = `${winRate}%`;
        }
        
        if (currentStreakEl) {
            currentStreakEl.textContent = `${currentStreak} days`;
        }
        
        // Recent activity - generate dynamic activities based on current stats
        const recentActivityEl = document.getElementById('recentActivity');
        if (recentActivityEl) {
            const activities = [];
            
            // Add activities based on current progress
            if (level > 1) {
                activities.push(`• Level ${level} achieved!`);
            }
            if (coins > 0) {
                activities.push(`• ${coins.toLocaleString()} DZD earned`);
            }
            if (quests > 0) {
                activities.push(`• ${quests} quests completed`);
            }
            if (achievements > 0) {
                activities.push(`• ${achievements} achievements unlocked`);
            }
            if (gamesPlayed > 0) {
                activities.push(`• ${gamesPlayed} games played`);
            }
            if (winRate > 0) {
                activities.push(`• ${winRate}% win rate achieved`);
            }
            
            // Add default activities if no progress yet
            if (activities.length === 0) {
                activities.push(`• Welcome to the game!`);
                activities.push(`• Profile created successfully`);
                activities.push(`• Ready to start your journey`);
            }
            
            // Show last 5 activities
            recentActivityEl.innerHTML = activities.slice(0, 5).map(activity => `<div>${activity}</div>`).join('');
        }
        
        console.log('👤 Enhanced profile info updated with Firebase data:', { 
            user: finalUser, 
            stats: finalStats,
            level,
            experience,
            coins,
            quests,
            gamesPlayed,
            winRate,
            xpSystem: `Level ${level} needs ${expForNextLevel} XP (${currentLevelExp}/${expForNextLevel})`,
            firebaseUser: finalUser?.uid ? '✅ Connected' : '❌ Not connected',
            profilePicture: finalUser?.photoURL ? '✅ Available' : '❌ Not available',
            displayName: finalUser?.displayName || 'Using email'
        });
    }
    
    async handleLogout() {
        console.log('🚪 Logout initiated from settings dropdown');
        try {
            // Try multiple logout methods to ensure it works
            if (this.game && this.game.auth && this.game.auth.logout) {
                await this.game.auth.logout();
            } else if (window.auth && window.auth.signOut) {
                await window.auth.signOut();
            } else if (window.firebase && window.firebase.auth) {
                await window.firebase.auth().signOut();
            } else {
                // Fallback: clear local storage and reload
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
            }
            console.log('✅ User logged out successfully');
        } catch (error) {
            console.error('❌ Logout error:', error);
            // Fallback logout
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        }
    }
    
    showSettingsModal() {
        // Create settings modal
        let settingsModal = document.getElementById('settings-modal');
        if (!settingsModal) {
            settingsModal = document.createElement('div');
            settingsModal.id = 'settings-modal';
            settingsModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 20px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                position: relative;
            `;
            
            modalContent.innerHTML = `
                <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;">⚙️ Settings</h2>
                
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="settings-section">
                        <h3 style="margin: 0 0 15px 0; color: #1d1d1f; font-size: 18px;">🎮 Game Settings</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="debugMode" style="transform: scale(1.2);">
                                <span>Debug Mode</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="soundEnabled" checked style="transform: scale(1.2);">
                                <span>Sound Effects</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="musicEnabled" checked style="transform: scale(1.2);">
                                <span>Background Music</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3 style="margin: 0 0 15px 0; color: #1d1d1f; font-size: 18px;">🎨 Display Settings</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="showFPS" style="transform: scale(1.2);">
                                <span>Show FPS Counter</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="fullscreen" style="transform: scale(1.2);">
                                <span>Fullscreen Mode</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3 style="margin: 0 0 15px 0; color: #1d1d1f; font-size: 18px;">📊 Statistics</h3>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border-left: 4px solid #007AFF;">
                            <p style="margin: 0 0 5px 0; color: #666;">Current Level: <strong id="settingsLevel">1</strong></p>
                            <p style="margin: 0 0 5px 0; color: #666;">Total Coins: <strong id="settingsCoins">0</strong> DZD</p>
                            <p style="margin: 0; color: #666;">Experience: <strong id="settingsExp">0</strong></p>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                    <button id="settingsCancel" style="
                        background: rgba(255, 59, 48, 0.1);
                        color: #ff3b30;
                        border: 2px solid rgba(255, 59, 48, 0.3);
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Cancel</button>
                    <button id="settingsSave" style="
                        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Save Settings</button>
                </div>
                
                <button id="closeSettingsModal" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                ">×</button>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(settingsModal);
            
            // Add event listeners
            document.getElementById('closeSettingsModal').addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
            
            document.getElementById('settingsCancel').addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
            
            document.getElementById('settingsSave').addEventListener('click', () => {
                this.saveSettings();
                settingsModal.style.display = 'none';
                this.game.auth.showBottomNotification('✅ Settings saved!', 'success');
            });
            
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.style.display = 'none';
                }
            });
        }
        
        // Update statistics in modal
        if (this.game && this.game.auth && this.game.auth.userStats) {
            const stats = this.game.auth.userStats;
            const levelEl = document.getElementById('settingsLevel');
            const coinsEl = document.getElementById('settingsCoins');
            const expEl = document.getElementById('settingsExp');
            
            if (levelEl) levelEl.textContent = stats.level || 1;
            if (coinsEl) coinsEl.textContent = stats.points || 0;
            if (expEl) expEl.textContent = stats.experience || 0;
        }
        
        settingsModal.style.display = 'flex';
    }
    
    saveSettings() {
        // Get settings values
        const debugMode = document.getElementById('debugMode').checked;
        const soundEnabled = document.getElementById('soundEnabled').checked;
        const musicEnabled = document.getElementById('musicEnabled').checked;
        const showFPS = document.getElementById('showFPS').checked;
        const fullscreen = document.getElementById('fullscreen').checked;
        
        // Save to localStorage
        const settings = {
            debugMode,
            soundEnabled,
            musicEnabled,
            showFPS,
            fullscreen
        };
        
        localStorage.setItem('gameSettings', JSON.stringify(settings));
        
        // Apply settings
        if (this.game) {
            this.game.debugMode = debugMode;
        }
        
        console.log('⚙️ Settings saved:', settings);
    }
    
    showLogin() {
        this.elements.loginScreen.style.display = 'flex';
        this.elements.loadingScreen.style.display = 'none';
        this.elements.gameContainer.style.display = 'none';
    }
    
    hideLogin() {
        this.elements.loginScreen.style.display = 'none';
    }
    
    showLoading() {
        this.elements.loginScreen.style.display = 'none';
        this.elements.loadingScreen.style.display = 'flex';
        this.elements.gameContainer.style.display = 'block';
    }
    
    hideLoading() {
        this.elements.loadingScreen.style.opacity = '0';
        setTimeout(() => {
            this.elements.loadingScreen.style.display = 'none';
        }, 500);
    }
    
    showError(message) {
        console.error('UI Error:', message);
    }
    
    updateUserStats(stats) {
        if (!stats) return;
        
        // Store previous values for comparison
        const previousStats = this.lastStats || {};
        
        // Update level (CoC-style HUD)
        if (this.elements.userLevel) {
            if (this.elements.userLevel.textContent !== stats.level.toString()) {
                this.elements.userLevel.textContent = stats.level;
                this.highlightStatChange('userLevel');
            }
        }
        
        // Update points/coins (CoC-style HUD)
        if (this.elements.userPoints) {
            if (this.elements.userPoints.textContent !== stats.points.toString()) {
                this.elements.userPoints.textContent = stats.points;
                this.highlightStatChange('userPoints');
            }
        }
        
        // Update player name and XP bar (CoC-style HUD)
        if (this.elements.playerName) {
            // Get player name from Firestore stats (name field)
            let displayName = 'Player';
            
            // First try to get from stats (from Firestore)
            if (stats && stats.name) {
                displayName = stats.name;
            } else if (this.auth && this.auth.userStats && this.auth.userStats.name) {
                // Fallback to auth userStats
                displayName = this.auth.userStats.name;
            } else if (this.auth && this.auth.user) {
                // Final fallback to email or displayName
                displayName = this.auth.user.displayName || 
                             this.auth.user.email?.split('@')[0] || 
                             'Player';
            }
            
            // Update player name text
            if (this.elements.playerName.textContent !== displayName) {
                this.elements.playerName.textContent = displayName;
                this.highlightStatChange('playerName');
            }
        }
        
        // Update XP bar (experience calculation for bar fill)
        {
            let currentExp, maxExp, expPercentage;
            
            if (stats.level >= 10) {
                currentExp = 'MAX';
                maxExp = 'MAX';
                expPercentage = 100;
            } else {
                maxExp = stats.level * 100; // Level 1: 100, Level 2: 200, etc.
                currentExp = stats.experience;
                expPercentage = Math.min((stats.experience / maxExp) * 100, 100);
            }
            
            // Update XP bar fill
            const xpBarFill = document.getElementById('xpBarFill');
            if (xpBarFill) {
                xpBarFill.style.width = `${expPercentage}%`;
            }
        }
        
        
        // Update player avatar
        if (this.elements.playerAvatar) {
            if (stats.skin && stats.skin.trim() !== '') {
                if (this.elements.playerAvatar.src !== stats.skin) {
                    this.elements.playerAvatar.src = stats.skin;
                    this.elements.playerAvatar.style.display = 'block';
                    this.elements.playerAvatar.onerror = () => {
                        this.elements.playerAvatar.style.display = 'none';
                    };
                    }
                } else {
                this.elements.playerAvatar.style.display = 'none';
            }
        }
        
        // Store current stats for next comparison
        this.lastStats = { ...stats };
        
        // Update quest progress
        this.updateQuestProgress(stats);
    }
    
    // Add visual feedback when stats change
    highlightStatChange(elementId) {
        const element = this.elements[elementId];
        if (element) {
            element.style.transition = 'all 0.3s ease';
            element.style.backgroundColor = '#4CAF50';
            element.style.color = 'white';
            element.style.borderRadius = '4px';
            element.style.padding = '2px 4px';
            
            setTimeout(() => {
                element.style.backgroundColor = '';
                element.style.color = '';
                element.style.borderRadius = '';
                element.style.padding = '';
            }, 1000);
        }
    }
    
    // Helper method to check if quest is expired
    isQuestExpired(endTime) {
        if (!endTime) return false;
        
        // Handle different time formats and timezone issues
        let end;
        if (typeof endTime === 'string') {
            // Try to parse as ISO string first
            end = new Date(endTime);
            // If parsing failed or resulted in invalid date, try alternative parsing
            if (isNaN(end.getTime())) {
                console.warn('⚠️ Invalid endTime format in isQuestExpired, trying alternative parsing:', endTime);
                // Try parsing as timestamp
                const timestamp = parseInt(endTime);
                if (!isNaN(timestamp)) {
                    end = new Date(timestamp);
                } else {
                    console.error('❌ Could not parse endTime in isQuestExpired:', endTime);
                    return false; // Don't mark as expired if we can't parse the time
                }
            }
        } else {
            end = new Date(endTime);
        }
        
        const now = new Date();
        
        // Debug logging to help identify the issue
        console.log('🔍 Quest expiration check:', {
            endTime: endTime,
            endDate: end,
            now: now,
            timeDifference: end - now,
            isExpired: end <= now,
            timeSinceExpiry: now - end,
            isValidDate: !isNaN(end.getTime())
        });
        
        return end <= now;
    }

    updatePlayerQuests(quests) {
        const questContent = document.querySelector('.quest-content');
        if (!questContent) return;
        
        // Get seen quest IDs from database (userStats)
        const seenQuestIds = this.game?.auth?.userStats?.seenQuests || [];
        const currentQuestIds = quests.map(q => q.id);
        
        // Check if there are any unseen quests
        const unseenQuestIds = currentQuestIds.filter(id => !seenQuestIds.includes(id));
        const hasUnseenQuests = unseenQuestIds.length > 0;
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        if (quests.length === 0) {
            const noQuestsDiv = document.createElement('div');
            noQuestsDiv.className = 'no-quests';
            noQuestsDiv.textContent = 'No active quests';
            fragment.appendChild(noQuestsDiv);
        } else {
            // Create quest elements efficiently
            quests.forEach(quest => {
                const questElement = this.createQuestElement(quest);
                fragment.appendChild(questElement);
            });
        }
        
        // Clear and append all at once
        questContent.innerHTML = '';
        questContent.appendChild(fragment);
        
        // Show notification badge if there are unseen quests and panel is closed
        this.updateQuestNotification(hasUnseenQuests);
        
        // Start quest timer updates
        this.startQuestTimerUpdates();
    }
    
    async markQuestsAsSeen() {
        if (!this.game?.auth?.user || !this.game?.auth?.userStats || !window.db) return;
        
        try {
            // Get current quest IDs
            const questContent = document.querySelector('.quest-content');
            if (!questContent) return;
            
            const questElements = questContent.querySelectorAll('.quest-item');
            const currentQuestIds = Array.from(questElements).map(el => el.getAttribute('data-quest-id')).filter(id => id);
            
            if (currentQuestIds.length === 0) return;
            
            // Get existing seen quest IDs
            const existingSeenQuests = this.game.auth.userStats.seenQuests || [];
            
            // Merge with current quest IDs (remove duplicates)
            const allSeenQuests = [...new Set([...existingSeenQuests, ...currentQuestIds])];
            
            // Update userStats
            this.game.auth.userStats.seenQuests = allSeenQuests;
            
            // Save to database
            await this.game.auth.saveUserStats();
            
            console.log('✅ Marked quests as seen:', currentQuestIds);
        } catch (error) {
            console.error('❌ Error marking quests as seen:', error);
        }
    }
    
    updateQuestNotification(hasUnseenQuests) {
        const notificationBadge = document.getElementById('questNotificationBadge');
        const questPanel = this.elements.questPanel;
        const questToggle = this.elements.questToggle;
        
        if (!notificationBadge || !questPanel || !questToggle) return;
        
        // Only show notification if there are unseen quests and panel is closed
        const isPanelOpen = questPanel.classList.contains('open');
        
        if (hasUnseenQuests && !isPanelOpen) {
            notificationBadge.style.display = 'block';
        } else {
            // Hide notification if panel is open or no unseen quests
            notificationBadge.style.display = 'none';
        }
    }
    
    createQuestElement(quest) {
        const timerInfo = this.game.auth.formatQuestTimeRemaining(quest.endTime);
        const isPlayerDone = quest.status === 'player_done';
        const isCompleted = quest.status === 'completed';
        const isExpired = this.isQuestExpired(quest.endTime);
        
        // Check if player has already submitted a justification
        const currentUserId = this.game.auth.user?.uid || this.game.auth.user?.email;
        const hasJustification = quest.playerJustification && 
            (quest.playerJustification.playerId === currentUserId || 
             quest.playerJustification.playerId === this.game.auth.user?.email);
        
        const questDiv = document.createElement('div');
        questDiv.className = `quest-item ${isPlayerDone ? 'quest-player-done' : ''} ${isCompleted ? 'quest-completed' : ''} ${isExpired ? 'quest-expired' : ''}`;
        questDiv.setAttribute('data-quest-id', quest.id);
        
        // Compact view - only name, time, and 3-dots button
        questDiv.innerHTML = `
            <div class="quest-compact">
                <div class="quest-compact-info">
                    <div class="quest-title">${quest.name}</div>
                    <div class="quest-timer ${timerInfo.class}" data-end-time="${quest.endTime}">
                        ${isCompleted ? '✅ Completed' : isPlayerDone ? '⏳ Waiting' : timerInfo.text}
                    </div>
                </div>
                <button class="quest-details-btn" data-quest-id="${quest.id}">
                    ⋯
                </button>
            </div>
            
            <!-- Expanded details (hidden by default) -->
            <div class="quest-details" style="display: none;">
                <div class="quest-description">${quest.description}</div>
                <div class="quest-rewards">
                    <span class="reward-badge reward-xp">+${quest.xpReward || 0} XP</span>
                    <span class="reward-badge reward-coins">+${quest.coinsReward || 0} DZD</span>
                </div>
                <div class="quest-actions">
                    ${isExpired && !isPlayerDone && !isCompleted ? `
                        ${hasJustification ? `
                            <button class="justify-btn" data-quest-id="${quest.id}" disabled style="
                                opacity: 0.7;
                                cursor: not-allowed;
                                background: rgba(52, 199, 89, 0.6);
                                border-color: rgba(52, 199, 89, 0.3);
                                color: white;
                            ">
                                ✅ Justification Sent
                            </button>
                        ` : `
                            <button class="justify-btn" data-quest-id="${quest.id}">
                                📝 Justify Non-Completion
                            </button>
                        `}
                    ` : `
                        ${quest.verificationLink ? `
                            <button class="verification-btn" data-verification-link="${quest.verificationLink}">
                                ${quest.verificationName || 'Verify Quest'}
                            </button>
                        ` : ''}
                        ${isCompleted ? `
                            <button class="done-btn completed" disabled>
                                ✅ Completed
                            </button>
                        ` : isPlayerDone ? `
                            <button class="done-btn waiting-approval" disabled>
                                ⏳ Waiting for Approval
                            </button>
                        ` : `
                            <button class="done-btn" data-quest-id="${quest.id}">
                                Done
                            </button>
                        `}
                    `}
                </div>
            </div>
        `;
        
        // Add event listeners using event delegation
        questDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('quest-details-btn')) {
                this.toggleQuestDetails(questDiv);
            } else if (e.target.classList.contains('verification-btn')) {
                const link = e.target.getAttribute('data-verification-link');
                if (link) window.open(link, '_blank');
            } else if (e.target.classList.contains('done-btn') && !e.target.disabled) {
                const questId = e.target.getAttribute('data-quest-id');
                if (questId) this.handleQuestDone(questId);
            } else if (e.target.classList.contains('justify-btn')) {
                const questId = e.target.getAttribute('data-quest-id');
                if (questId) this.showQuestJustificationModal(questId);
            }
        });
        
        return questDiv;
    }
    
    toggleQuestDetails(questDiv) {
        const detailsDiv = questDiv.querySelector('.quest-details');
        const detailsBtn = questDiv.querySelector('.quest-details-btn');
        
        if (detailsDiv.style.display === 'none') {
            // Expand details
            detailsDiv.style.display = 'block';
            detailsBtn.textContent = '×';
            detailsBtn.classList.add('expanded');
        } else {
            // Collapse details
            detailsDiv.style.display = 'none';
            detailsBtn.textContent = '⋯';
            detailsBtn.classList.remove('expanded');
        }
    }
    
    startQuestTimerUpdates() {
        // Clear existing timer
        if (this.questTimerInterval) {
            clearInterval(this.questTimerInterval);
        }
        
        // Update timers every 2 seconds to reduce lag
        this.questTimerInterval = setInterval(() => {
            this.updateQuestTimers();
        }, 10000);
    }
    
    updateQuestTimers() {
        const questItems = document.querySelectorAll('.quest-item');
        const now = new Date(); // Get current time once
        
        questItems.forEach(item => {
            const timerElement = item.querySelector('.quest-timer');
            if (!timerElement || !timerElement.dataset.endTime) return;
            
            // Check if quest is player_done or completed - don't update timer
            if (item.classList.contains('quest-player-done') || item.classList.contains('quest-completed')) {
                return; // Skip timer updates for done/completed quests
            }
            
            const endTime = new Date(timerElement.dataset.endTime);
            const timeLeft = endTime - now;
            
            if (timeLeft <= 0) {
                // Quest has expired - show time since expiration
                const timeSinceExpiry = Math.abs(timeLeft);
                const expiredText = this.game.auth.formatTimeSinceExpiry(timeSinceExpiry);
                timerElement.textContent = `Expired ${expiredText} ago`;
                timerElement.className = 'quest-timer expired';
                
                // Add expired styling to the entire quest item
                item.classList.add('quest-expired');
            } else {
                // Only update if the display would change significantly
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                
                let newText;
                if (hours > 0) {
                    newText = `${hours}h ${minutes}m`;
                } else if (minutes > 0) {
                    newText = `${minutes}m ${seconds}s`;
                } else {
                    newText = `${seconds}s`;
                }
                
                // Only update if text actually changed
                if (timerElement.textContent !== newText) {
                    timerElement.textContent = newText;
                }
                
                // Remove expired styling
                item.classList.remove('quest-expired');
                
                // Change styling based on time remaining
                let newClassName = 'quest-timer active';
                if (timeLeft < 60000) { // Less than 1 minute
                    newClassName = 'quest-timer ending';
                } else if (timeLeft < 3600000) { // Less than 1 hour
                    newClassName = 'quest-timer ending';
                }
                
                // Only update class if it changed
                if (timerElement.className !== newClassName) {
                    timerElement.className = newClassName;
                }
            }
        });
    }
    
    updateQuestProgress(stats) {
        // This method is now handled by updatePlayerQuests
        // Keeping it for backward compatibility but it's no longer used
    }
    
    handleQuestDone(questId) {
        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to mark this quest as done?');
        
        if (confirmed) {
            // Delegate to the auth manager
            if (this.game.auth && this.game.auth.handleQuestDone) {
                this.game.auth.handleQuestDone(questId);
            }
        }
    }
    
    showQuestJustificationModal(questId) {
        // Find the quest data
        const questItem = document.querySelector(`[data-quest-id="${questId}"]`);
        if (!questItem) return;
        
        const questTitle = questItem.querySelector('.quest-title').textContent;
        const questDescription = questItem.querySelector('.quest-description').textContent;
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'quest-justification-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
        `;
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        modalContent.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
            <h3 style="margin: 0 0 15px 0; color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Quest Justification
            </h3>
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(0, 0, 0, 0.05); border-radius: 10px; text-align: left;">
                <h4 style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Quest:</h4>
                <p style="margin: 0; color: #333; font-weight: 600;">${questTitle}</p>
                <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">${questDescription}</p>
            </div>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
                Please explain why you were unable to complete this quest. Your explanation will be sent to the admin for review.
            </p>
            <div style="position: relative; margin-bottom: 20px;">
                <textarea id="justificationText" placeholder="Enter your justification here..." style="
                    width: 100%;
                    height: 120px;
                    padding: 15px;
                    border: 2px solid rgba(0, 0, 0, 0.1);
                    border-radius: 12px;
                    font-size: 14px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    resize: vertical;
                    box-sizing: border-box;
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                    user-select: text;
                    pointer-events: auto;
                    touch-action: manipulation;
                    background: white;
                    outline: none;
                    position: relative;
                    z-index: 10001;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                    display: block;
                    overflow: auto;
                "></textarea>
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                    z-index: -1;
                    background: transparent;
                "></div>
            </div>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="justify-cancel" style="
                    background: rgba(255, 59, 48, 0.1);
                    color: #ff3b30;
                    border: 2px solid rgba(255, 59, 48, 0.3);
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">Cancel</button>
                <button id="justify-submit" style="
                    background: rgba(52, 199, 89, 0.9);
                    color: white;
                    border: 2px solid rgba(52, 199, 89, 0.3);
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">Submit Justification</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Prevent modal from closing when clicking on content
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Only close modal when clicking the background
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        // Prevent textarea click from closing modal and ensure it's focusable
        const textarea = modalContent.querySelector('#justificationText');
        textarea.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Add additional event listeners to ensure textarea works
        textarea.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        });
        
        textarea.addEventListener('touchend', (e) => {
            e.stopPropagation();
        });
        
        textarea.addEventListener('input', (e) => {
            e.stopPropagation();
        });
        
        textarea.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        
        textarea.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });
        
        // Add hover effects
        const cancelBtn = modalContent.querySelector('#justify-cancel');
        const submitBtn = modalContent.querySelector('#justify-submit');
        
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255, 59, 48, 0.2)';
            cancelBtn.style.borderColor = 'rgba(255, 59, 48, 0.5)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'rgba(255, 59, 48, 0.1)';
            cancelBtn.style.borderColor = 'rgba(255, 59, 48, 0.3)';
        });
        
        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.background = 'rgba(52, 199, 89, 1)';
            submitBtn.style.borderColor = 'rgba(52, 199, 89, 0.5)';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.background = 'rgba(52, 199, 89, 0.9)';
            submitBtn.style.borderColor = 'rgba(52, 199, 89, 0.3)';
        });
        
        // Handle button clicks
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        submitBtn.addEventListener('click', () => {
            let justificationText = modalContent.querySelector('#justificationText').value.trim();
            
            // Fallback: if textarea is empty, try prompt
            if (!justificationText) {
                justificationText = prompt('Please enter your justification for not completing this quest:');
                if (!justificationText || justificationText.trim() === '') {
                    this.game.auth.showBottomNotification('❌ Please enter a justification', 'error');
                    return;
                }
            }
            
            // Submit the justification
            this.submitQuestJustification(questId, questTitle, justificationText);
            document.body.removeChild(modal);
        });
        
        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Focus on textarea and ensure it's ready for input
        setTimeout(() => {
            const textarea = modalContent.querySelector('#justificationText');
            textarea.focus();
            textarea.click(); // Ensure it's properly activated
            
            // Force focus on mobile devices
            if (textarea.setSelectionRange) {
                textarea.setSelectionRange(0, 0);
            }
            
            // Additional mobile focus handling
            textarea.addEventListener('focus', () => {
                console.log('Textarea focused');
            });
            
            textarea.addEventListener('blur', () => {
                console.log('Textarea blurred');
            });
        }, 300);
    }
    
    async submitQuestJustification(questId, questTitle, justificationText) {
        try {
            // Show loading notification
            this.game.auth.showBottomNotification('📤 Submitting justification...', 'info');
            
            // Create justification data
            const justification = {
                id: Date.now().toString(),
                questId: questId,
                questName: questTitle,
                playerId: this.game.auth.user?.uid || this.game.auth.user?.email,
                playerName: this.game.auth.user?.displayName || this.game.auth.user?.email || 'Unknown Player',
                message: justificationText,
                timestamp: new Date().toISOString(),
                status: 'unread'
            };
            
            // Save to Firebase
            await this.saveQuestJustificationToFirebase(justification);
            
            // Show success notification
            this.game.auth.showBottomNotification('✅ Justification submitted successfully!', 'success');
            
            // Update the quest button to show it was justified
            this.updateQuestJustificationStatus(questId);
            
            // Reload quests to reflect the updated state
            if (this.game.auth && this.game.auth.loadPlayerQuests) {
                await this.game.auth.loadPlayerQuests();
            }
            
        } catch (error) {
            console.error('❌ Error submitting quest justification:', error);
            this.game.auth.showBottomNotification('❌ Failed to submit justification', 'error');
        }
    }
    
    async saveQuestJustificationToFirebase(justification) {
        if (!window.db) {
            throw new Error('Firebase not initialized');
        }
        
        try {
            // Save to admin_messages collection
            const messageRef = window.doc(window.db, 'admin_messages', justification.id);
            await window.setDoc(messageRef, justification);
            
            // Also update the quest document with the justification
            await this.updateQuestWithJustification(justification);
            
            console.log('✅ Quest justification saved to Firebase:', justification);
        } catch (error) {
            console.error('❌ Error saving quest justification to Firebase:', error);
            throw error;
        }
    }
    
    async updateQuestWithJustification(justification) {
        try {
            // Update the quest document with the justification
            const questRef = window.doc(window.db, 'quests', justification.questId);
            await window.updateDoc(questRef, {
                playerJustification: {
                    message: justification.message,
                    playerId: justification.playerId,
                    playerName: justification.playerName,
                    timestamp: justification.timestamp,
                    status: 'pending_review'
                },
                lastUpdated: new Date().toISOString()
            });
            
            console.log('✅ Quest updated with player justification');
        } catch (error) {
            console.error('❌ Error updating quest with justification:', error);
            // Don't throw error here - the message was already saved to admin_messages
        }
    }
    
    updateQuestJustificationStatus(questId) {
        // Find the quest item and update the button
        const questItem = document.querySelector(`[data-quest-id="${questId}"]`);
        if (questItem) {
            const justifyBtn = questItem.querySelector('.justify-btn');
            if (justifyBtn) {
                justifyBtn.textContent = '✅ Justification Sent';
                justifyBtn.disabled = true;
                justifyBtn.style.opacity = '0.7';
                justifyBtn.style.cursor = 'not-allowed';
                justifyBtn.style.background = 'rgba(52, 199, 89, 0.6)';
                justifyBtn.style.borderColor = 'rgba(52, 199, 89, 0.3)';
                justifyBtn.style.color = 'white';
                
                // Remove click event listener to prevent any interaction
                justifyBtn.onclick = null;
                justifyBtn.removeEventListener('click', this.showQuestJustificationModal);
            }
        }
    }
    
    // Handle quest completion (legacy method - keeping for compatibility)
    async handleQuestDoneLegacy(questId) {
        // Find the quest item
        const questItem = document.querySelector(`[data-quest-id="${questId}"]`);
        if (!questItem) return;
        
        // Check if quest is expired
        const timerElement = questItem.querySelector('.quest-timer');
        if (timerElement && timerElement.dataset.endTime) {
            const endTime = new Date(timerElement.dataset.endTime);
            const now = new Date();
            if (endTime <= now) {
                this.showBottomNotification('❌ Cannot complete expired quest', 'error');
                return;
            }
        }
        
        // Show confirmation popup
        const confirmed = await this.showQuestCompletionConfirmation();
        if (!confirmed) return;
        
        try {
            // Mark quest as player_done in Firebase (waiting for admin approval)
            await this.markQuestAsPlayerDone(questId);
            
            // Update UI to show quest as player_done (green but waiting for approval)
            questItem.classList.add('quest-player-done');
            questItem.classList.remove('quest-expired');
            
            // Disable the done button
            const doneBtn = questItem.querySelector('.done-btn');
            if (doneBtn) {
                doneBtn.disabled = true;
                doneBtn.textContent = 'Waiting for Approval';
                doneBtn.classList.add('waiting-approval');
            }
            
            // Show success notification
            this.showBottomNotification('✅ Quest submitted! Waiting for admin approval.', 'success');
            
            // Refresh quest list to show the updated status
            await this.game.auth.loadPlayerQuests();
            
        } catch (error) {
            console.error('Error completing quest:', error);
            this.showBottomNotification('❌ Failed to submit quest', 'error');
        }
    }
    
    // Show quest completion confirmation popup
    showQuestCompletionConfirmation() {
        return new Promise((resolve) => {
            // Create modal overlay
            const modal = document.createElement('div');
            modal.className = 'quest-confirmation-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            
            // Create modal content
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                border-radius: 20px;
                padding: 30px;
                text-align: center;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;
            
            modalContent.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 20px;">🤔</div>
                <h3 style="margin: 0 0 15px 0; color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Are you sure you finished your task?
                </h3>
                <p style="margin: 0 0 25px 0; color: #666; font-size: 14px;">
                    This action cannot be undone. Make sure you have completed all requirements.
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="confirm-cancel" style="
                        background: rgba(255, 59, 48, 0.1);
                        color: #ff3b30;
                        border: 2px solid rgba(255, 59, 48, 0.3);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    ">Cancel</button>
                    <button id="confirm-sure" style="
                        background: rgba(52, 199, 89, 0.9);
                        color: white;
                        border: 2px solid rgba(52, 199, 89, 0.3);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    ">Sure</button>
                </div>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Add hover effects
            const cancelBtn = modalContent.querySelector('#confirm-cancel');
            const sureBtn = modalContent.querySelector('#confirm-sure');
            
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'rgba(255, 59, 48, 0.2)';
                cancelBtn.style.borderColor = 'rgba(255, 59, 48, 0.5)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'rgba(255, 59, 48, 0.1)';
                cancelBtn.style.borderColor = 'rgba(255, 59, 48, 0.3)';
            });
            
            sureBtn.addEventListener('mouseenter', () => {
                sureBtn.style.background = 'rgba(52, 199, 89, 1)';
                sureBtn.style.borderColor = 'rgba(52, 199, 89, 0.5)';
            });
            sureBtn.addEventListener('mouseleave', () => {
                sureBtn.style.background = 'rgba(52, 199, 89, 0.9)';
                sureBtn.style.borderColor = 'rgba(52, 199, 89, 0.3)';
            });
            
            // Handle button clicks
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            sureBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
            
            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }
    
    // Mark quest as player_done in Firebase (waiting for admin approval)
    async markQuestAsPlayerDone(questId) {
        if (!window.db) {
            throw new Error('Firebase not initialized');
        }
        
        try {
            // Update quest status in Firebase
            const questRef = window.doc(window.db, 'quests', questId);
            await window.updateDoc(questRef, {
                status: 'player_done',
                playerDoneAt: new Date().toISOString(),
                playerDoneBy: this.game.auth.user?.uid || this.game.auth.user?.email
            });
            
            console.log('✅ Quest marked as player_done in Firebase (waiting for admin approval)');
        } catch (error) {
            console.error('❌ Error updating quest in Firebase:', error);
            throw error;
        }
    }
    
    render(ctx) {
        // Render joystick if active
        if (this.game.input.joystick.active) {
            this.renderJoystick(ctx);
        }
    }
    
    renderJoystick(ctx) {
        const joystick = this.game.input.joystick;
        
        // Outer circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(joystick.center.x, joystick.center.y, joystick.maxDistance, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner circle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(joystick.position.x, joystick.position.y, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Authentication Manager - Handles Firebase auth and user stats
 */
class AuthManager {
    constructor(game) {
        this.game = game;
        this.user = null;
        this.userStats = null;
        this.authStateListeners = [];
    }
    
    async init() {
        // Wait for Firebase
        await this.waitForFirebase();
        
        // Listen for auth state changes
        window.onAuthStateChanged(window.auth, (user) => {
            console.log("🔥 Auth state changed:", user ? user.email : "No user");
            this.user = user;
            this.notifyAuthStateListeners(user);
            
            // Load user stats if user is logged in
            if (user) {
                this.loadUserStats();
                // Reset login loading state
                this.setLoginLoading(false);
                // If we're in login state and user just logged in, start the game
                if (this.game.gameState === 'login') {
                    console.log("🎮 User logged in, starting game...");
                    this.game.startGame();
                }
            } else {
                // User logged out, show login screen only if we're currently playing
                if (this.game.gameState === 'playing') {
                    console.log("👋 User logged out, showing login...");
                    this.game.showLogin();
                }
                // Don't show login form during initialization - let waitForAuthState handle it
            }
        });
        
        // Setup login form
        this.setupLoginForm();
        
        // Set up real-time stat update listeners
        this.setupRealTimeUpdates();
    }
    
    waitForFirebase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait
            
            const check = () => {
                attempts++;
                console.log(`⏳ Waiting for Firebase... (attempt ${attempts}/${maxAttempts})`);
                
                if (window.auth && window.onAuthStateChanged) {
                    console.log("✅ Firebase is ready!");
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error("❌ Firebase initialization timeout");
                    resolve(); // Continue anyway
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
        if (this.user !== null) {
            callback(this.user);
        }
    }
    
    notifyAuthStateListeners(user) {
        this.authStateListeners.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('Auth state listener error:', error);
            }
        });
    }
    
    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Stats HUD buttons
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            console.log('✅ Logout button found and event listener attached');
            logoutButton.addEventListener('click', () => this.handleLogout());
        } else {
            console.log('❌ Logout button not found');
        }
        
        const hudRefreshButton = document.getElementById('hudRefreshButton');
        if (hudRefreshButton) {
            console.log('✅ HUD Refresh button found and event listener attached');
            hudRefreshButton.addEventListener('click', () => this.handleHudRefresh());
        } else {
            console.log('❌ HUD Refresh button not found');
        }
        
        // Login form refresh button
        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.handleRefresh());
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        
        console.log("🔐 Attempting login for:", email);
        this.setLoginLoading(true);
        
        try {
            // First, try normal Firebase Auth login
            const result = await window.signInWithEmailAndPassword(window.auth, email, password);
            console.log("✅ Login successful:", result.user.email);
            // Don't set loading to false here - let the auth state change handle it
        } catch (error) {
            console.log("⚠️ Firebase Auth login failed, checking for admin-created account...");
            console.log("🔍 Original error:", error.code, error.message);
            
            // If Firebase Auth fails, check if this is an admin-created account
            try {
                await this.handleAdminCreatedAccount(email, password);
            } catch (adminError) {
                console.error("❌ Admin account creation/login failed:", adminError);
                
                // Show more specific error message
                let errorMessage = "Login failed. ";
                if (adminError.message.includes("No account found")) {
                    errorMessage += "Account not found. Please check if the account was created in the admin dashboard.";
                } else if (adminError.message.includes("Invalid password")) {
                    errorMessage += "Incorrect password.";
                } else if (adminError.message.includes("Firebase Auth account")) {
                    errorMessage += "Failed to create authentication account. Please try again.";
                } else {
                    errorMessage += adminError.message;
                }
                
                this.showLoginError(errorMessage);
                this.setLoginLoading(false);
            }
        }
    }
    
    async handleAdminCreatedAccount(email, password) {
        console.log("🔍 Looking for admin-created account:", email);
        
        try {
            // Validate email format first
            if (!this.isValidEmail(email)) {
                throw new Error('Invalid email format. Please use a valid email address.');
            }
            
            // Search for user document by email in Firestore
            const usersRef = window.collection(window.db, 'users');
            const q = window.query(usersRef, window.where('email', '==', email));
            const querySnapshot = await window.getDocs(q);
            
            console.log("📊 Query results:", querySnapshot.size, "documents found");
            
            if (querySnapshot.empty) {
                console.log("❌ No documents found for email:", email);
                throw new Error('No account found with this email. Please check if the account was created in the admin dashboard.');
            }
            
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            console.log("📋 User document data:", userData);
            console.log("🔑 needsAuthCreation:", userData.needsAuthCreation);
            console.log("🔐 Password match:", userData.password === password);
            
            if (userData.needsAuthCreation && userData.password === password) {
                console.log("🆕 Creating Firebase Auth account for admin-created user...");
                
                try {
                    // Create Firebase Auth account
                    const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
                    const newUserId = userCredential.user.uid;
                    
                    console.log("✅ Firebase Auth account created with UID:", newUserId);
                    
                    // Update the existing document with the new Firebase Auth UID and remove auth creation flags
                    await window.updateDoc(window.doc(window.db, 'users', userDoc.id), {
                        needsAuthCreation: false,
                        password: window.deleteField() // Remove password from document
                    });
                    
                    console.log("✅ Existing Firestore document updated with auth flags removed");
                    
                    // Now sign in with the new account
                    await window.signInWithEmailAndPassword(window.auth, email, password);
                    
                    console.log("✅ Successfully signed in with new Firebase Auth account");
                    
                } catch (authError) {
                    console.error("❌ Firebase Auth creation failed:", authError);
                    
                    // Provide more specific error messages
                    if (authError.code === 'auth/invalid-email') {
                        throw new Error('Invalid email format. Please use a valid email address (e.g., user@example.com).');
                    } else if (authError.code === 'auth/email-already-in-use') {
                        throw new Error('This email is already registered. Try logging in normally.');
                    } else if (authError.code === 'auth/weak-password') {
                        throw new Error('Password is too weak. Please use a stronger password.');
                    } else {
                        throw new Error(`Failed to create Firebase Auth account: ${authError.message}`);
                    }
                }
                
            } else if (userData.password === password) {
                // Account exists but password matches - this shouldn't happen if needsAuthCreation is true
                console.log("⚠️ Account exists but needsAuthCreation is false");
                throw new Error('Account already has Firebase Auth. Try logging in normally.');
            } else {
                console.log("❌ Password mismatch");
                throw new Error('Invalid password');
            }
            
        } catch (error) {
            console.error("❌ handleAdminCreatedAccount error:", error);
            throw error;
        }
    }
    
    // Email validation helper method
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    async handleLogout() {
        console.log('🚪 Logout button clicked!');
        try {
            await window.auth.signOut();
            console.log('✅ User logged out successfully');
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    }
    
        handleRefresh() {
            const refreshButton = document.getElementById('refreshButton');
            if (!refreshButton) return;

            // Check if button is already disabled
            if (refreshButton.disabled) {
                console.log('⏳ Refresh button is on cooldown...');
                return;
            }

            console.log('🔄 Refreshing page...');

            // Disable the button for 5 seconds
            refreshButton.disabled = true;
            refreshButton.style.opacity = '0.5';
            refreshButton.style.cursor = 'not-allowed';

            // Add visual feedback
            refreshButton.style.transform = 'scale(0.95)';

            // Start cooldown timer
            let cooldownTime = 5;
            const originalTitle = refreshButton.title;
            
            const updateCooldown = () => {
                refreshButton.title = `Refresh Page (${cooldownTime}s)`;
                cooldownTime--;
                
                if (cooldownTime < 0) {
                    // Re-enable the button
                    refreshButton.disabled = false;
                    refreshButton.style.opacity = '1';
                    refreshButton.style.cursor = 'pointer';
                    refreshButton.style.transform = 'scale(1)';
                    refreshButton.title = originalTitle;
                    console.log('✅ Refresh button ready again');
                } else {
                    setTimeout(updateCooldown, 1000);
                }
            };

            // Start cooldown countdown
            setTimeout(updateCooldown, 1000);

            // Refresh the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 150);
        }
    
    async handleHudRefresh() {
        console.log('🔄 HUD Refresh button clicked');
        
        const hudRefreshButton = document.getElementById('hudRefreshButton');
        if (hudRefreshButton) {
            // Add visual feedback
            hudRefreshButton.style.transform = 'scale(0.95) rotate(180deg)';
            hudRefreshButton.style.opacity = '0.7';
            
            // Disable button temporarily
            hudRefreshButton.disabled = true;
        }
        
        // Save current quest panel state before refresh
        if (this.game && this.game.ui && this.game.ui.elements) {
            const isCurrentlyOpen = this.game.ui.elements.questPanel && 
                                    this.game.ui.elements.questPanel.classList.contains('open');
            if (this.game.ui.saveQuestPanelState) {
                await this.game.ui.saveQuestPanelState(isCurrentlyOpen);
            }
        }
        
        try {
            // Refresh user stats from Firestore
            if (this.user) {
                await this.loadUserStats();
                console.log('✅ User stats refreshed');
            }
            
            // Refresh player quests
            if (this.game && this.game.ui) {
                await this.loadPlayerQuests();
                console.log('✅ Player quests refreshed');
            }
            
            // Restore quest panel state after refresh (after both stats and quests are loaded)
            // Use a small delay to ensure DOM is ready
            setTimeout(() => {
                if (this.game && this.game.ui && this.game.ui.restoreQuestPanelState) {
                    this.game.ui.restoreQuestPanelState();
                }
            }, 100);
            
            // Show success feedback
            this.showHudRefreshSuccess();
            
        } catch (error) {
            console.error('❌ Error refreshing HUD data:', error);
            this.showHudRefreshError();
        } finally {
            // Re-enable button and reset visual state
            if (hudRefreshButton) {
                setTimeout(() => {
                    hudRefreshButton.style.transform = 'scale(1) rotate(0deg)';
                    hudRefreshButton.style.opacity = '1';
                    hudRefreshButton.disabled = false;
                }, 1000);
            }
        }
    }
    
    showHudRefreshSuccess() {
        this.showBottomNotification('✅ Stats refreshed', 'success');
    }
    
    showHudRefreshError() {
        this.showBottomNotification('❌ Refresh failed', 'error');
    }
    
    /**
     * Show notification at the bottom of the screen
     * @param {string} message - The notification message
     * @param {string} type - The notification type (success, error, info, warning)
     * @param {number} duration - How long to show the notification (default: 3000ms)
     */
    showBottomNotification(message, type = 'info', duration = 3000) {
        // Remove any existing notifications to prevent stacking
        const existingNotifications = document.querySelectorAll('.bottom-notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'bottom-notification';
        
        // Set colors based on type
        let backgroundColor, textColor, icon;
        switch (type) {
            case 'success':
                backgroundColor = 'rgba(52, 199, 89, 0.9)';
                textColor = 'white';
                icon = '✅';
                break;
            case 'error':
                backgroundColor = 'rgba(255, 59, 48, 0.9)';
                textColor = 'white';
                icon = '❌';
                break;
            case 'warning':
                backgroundColor = 'rgba(255, 149, 0, 0.9)';
                textColor = 'white';
                icon = '⚠️';
                break;
            case 'info':
            default:
                backgroundColor = 'rgba(0, 122, 255, 0.9)';
                textColor = 'white';
                icon = 'ℹ️';
                break;
        }
        
        // Apply styles
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${backgroundColor};
            color: ${textColor};
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 90vw;
            text-align: center;
            animation: slideUpIn 0.3s ease-out;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Set content
        notification.innerHTML = `${icon} ${message}`;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Add CSS animation if not already added
        if (!document.getElementById('bottom-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'bottom-notification-styles';
            style.textContent = `
                @keyframes slideUpIn {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                @keyframes slideDownOut {
                    from {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideDownOut 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, duration);
    }
    
    setLoginLoading(loading) {
        const loginButton = document.getElementById('loginButton');
        const loginButtonText = document.getElementById('loginButtonText');
        const loginSpinner = document.getElementById('loginSpinner');
        
        if (loginButton) loginButton.disabled = loading;
        if (loginButtonText) loginButtonText.style.display = loading ? 'none' : 'block';
        if (loginSpinner) loginSpinner.style.display = loading ? 'block' : 'none';
    }
    
    showLoginError(message) {
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }
    }
    
    getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            default:
                return 'Login failed. Please check your credentials.';
        }
    }
    
    async loadUserStats() {
        if (!this.user || !window.db) return;
        
        try {
            // First try to find by Firebase Auth UID
            let userDocRef = window.doc(window.db, 'users', this.user.uid);
            let userDoc = await window.getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                // If not found by UID, search by email (for admin-created accounts)
                console.log("🔍 User document not found by UID, searching by email...");
                const usersRef = window.collection(window.db, 'users');
                const q = window.query(usersRef, window.where('email', '==', this.user.email));
                const querySnapshot = await window.getDocs(q);
                
                if (!querySnapshot.empty) {
                    userDoc = querySnapshot.docs[0];
                    console.log("✅ User document found by email:", userDoc.id);
                }
            }
            
            if (userDoc && userDoc.exists()) {
                this.userStats = userDoc.data();
                console.log("✅ User stats loaded:", this.userStats);
                
                // Update last login timestamp
                await this.updateLastLogin();
            } else {
                // User document doesn't exist - this shouldn't happen if created via admin dashboard
                console.warn("⚠️ User document not found for:", this.user.email);
                this.userStats = {
                    email: this.user.email,
                    uid: this.user.uid, // Store Firebase Auth UID
                    name: 'Player', // Default name
                    level: 1,
                    points: 0,
                    experience: 0,
                    seenQuests: [], // Track quest IDs that have been seen
                    questPanelOpen: false, // Track quest panel open/closed state
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString()
                };
                await this.saveUserStats();
                console.log("✅ Created default user stats");
            }
            
            // Ensure UID is always stored in userStats
            if (this.userStats && !this.userStats.uid) {
                this.userStats.uid = this.user.uid;
                await this.saveUserStats();
                console.log("✅ Updated user stats with UID");
            }
            
            // Ensure seenQuests array exists
            if (this.userStats && !this.userStats.seenQuests) {
                this.userStats.seenQuests = [];
                await this.saveUserStats();
                console.log("✅ Initialized seenQuests array");
            }
            
            // Ensure questPanelOpen field exists (default to false if not set)
            if (this.userStats && this.userStats.questPanelOpen === undefined) {
                this.userStats.questPanelOpen = false;
                await this.saveUserStats();
                console.log("✅ Initialized questPanelOpen field");
            }
            
            this.game.ui.updateUserStats(this.userStats);
            
            // Restore quest panel state after userStats are loaded
            if (this.game.ui && this.game.ui.restoreQuestPanelState) {
                this.game.ui.restoreQuestPanelState();
            }
            
            // Load player's quests after loading user stats
            await this.loadPlayerQuests();
        } catch (error) {
            console.error('❌ Error loading user stats:', error);
        }
    }
    
    async loadPlayerQuests() {
        if (!this.user || !window.db) return;
        
        try {
            console.log("📋 Loading player quests...");
            
            // Get all active and player_done quests
            const questsRef = window.collection(window.db, 'quests');
            const q = window.query(questsRef, window.where('status', 'in', ['active', 'player_done']));
            const querySnapshot = await window.getDocs(q);
            
            const allQuests = [];
            querySnapshot.forEach((doc) => {
                allQuests.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Filter quests assigned to this player or to all players
            const playerQuests = [];
            
            for (const quest of allQuests) {
                let shouldInclude = false;
                
                // For player_done quests, only show if the player is the one who marked it as done
                if (quest.status === 'player_done') {
                    if (quest.playerDoneBy === this.user.uid || quest.playerDoneBy === this.user.email) {
                        shouldInclude = true;
                    }
                } else {
                    // Check if quest is assigned to all players (null, undefined, or empty string)
                    const assignedPlayer = quest.assignedPlayer;
                    if (!assignedPlayer || (typeof assignedPlayer === 'string' && assignedPlayer.trim() === '')) {
                        // Quest is assigned to all players
                        shouldInclude = true;
                    } else {
                        // Quest is assigned to a specific player
                        // Try multiple matching methods
                        
                        // 1. Direct match with Firebase Auth UID
                        if (assignedPlayer === this.user.uid) {
                            shouldInclude = true;
                        }
                        
                        // 2. Direct match with email
                        if (assignedPlayer === this.user.email) {
                            shouldInclude = true;
                        }
                        
                        // 3. Check if assignedPlayer is a Firestore document ID that belongs to us
                        if (!shouldInclude) {
                            try {
                                const userDocRef = window.doc(window.db, 'users', assignedPlayer);
                                const userDoc = await window.getDoc(userDocRef);
                                
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    // Check if this document belongs to the current user
                                    // Match by email, Firebase Auth UID, or Firestore document ID
                                    if (userData.email === this.user.email || 
                                        userData.uid === this.user.uid ||
                                        userDoc.id === this.user.uid) {
                                        shouldInclude = true;
                                    }
                                }
                            } catch (error) {
                                console.log('Could not check user document for quest assignment:', error);
                            }
                        }
                    }
                }
                
                if (shouldInclude) {
                    playerQuests.push(quest);
                }
            }
            
            console.log(`📋 Found ${playerQuests.length} quests for player`);
            console.log('📋 Current user info:', {
                uid: this.user.uid,
                email: this.user.email
            });
            console.log('📋 All quests in database:', allQuests.map(q => ({ 
                name: q.name, 
                assignedPlayer: q.assignedPlayer,
                status: q.status 
            })));
            console.log('📋 Filtered quests for player:', playerQuests.map(q => ({ 
                name: q.name, 
                assignedPlayer: q.assignedPlayer,
                status: q.status 
            })));
            
            // Update UI with player's quests
            this.game.ui.updatePlayerQuests(playerQuests);
            
        } catch (error) {
            console.error('❌ Error loading player quests:', error);
        }
    }
    
    async saveUserStats() {
        if (!this.user || !this.userStats || !window.db) return;
        
        try {
            // First try to save using Firebase Auth UID
            let userDocRef = window.doc(window.db, 'users', this.user.uid);
            let userDoc = await window.getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                // If document doesn't exist with UID, find by email
                console.log("🔍 Document not found by UID, searching by email for save...");
                const usersRef = window.collection(window.db, 'users');
                const q = window.query(usersRef, window.where('email', '==', this.user.email));
                const querySnapshot = await window.getDocs(q);
                
                if (!querySnapshot.empty) {
                    const existingDoc = querySnapshot.docs[0];
                    userDocRef = window.doc(window.db, 'users', existingDoc.id);
                    console.log("✅ Found existing document for save:", existingDoc.id);
                }
            }
            
            await window.setDoc(userDocRef, this.userStats);
            console.log("💾 User stats saved to database:", this.userStats);
        } catch (error) {
            console.error('❌ Error saving user stats:', error);
        }
    }
    
    // Method to update specific stats and save to database
    async updateStats(updates) {
        if (!this.userStats) return;
        
        // Update the stats
        Object.assign(this.userStats, updates);
        
        // Update UI immediately
        this.game.ui.updateUserStats(this.userStats);
        
        // Save to database
        await this.saveUserStats();
        
        console.log("📊 Stats updated:", updates);
    }
    
    // Method to update last login timestamp
    async updateLastLogin() {
        if (!this.user || !this.userStats || !window.db) return;
        
        try {
            // Update last login timestamp
            this.userStats.lastLogin = new Date().toISOString();
            
            // Save to database
            await this.saveUserStats();
            
            console.log("🕒 Last login updated:", this.userStats.lastLogin);
        } catch (error) {
            console.error('❌ Error updating last login:', error);
        }
    }
    
    
    
    // Method to refresh user stats from Firestore
    async refreshUserStats() {
        if (!this.user || !window.db) return;
        
        try {
            const userDocRef = window.doc(window.db, 'users', this.user.uid);
            const userDoc = await window.getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const freshStats = userDoc.data();
                this.userStats = freshStats;
                
                // Ensure UID is always stored
                if (!this.userStats.uid) {
                    this.userStats.uid = this.user.uid;
                    await this.saveUserStats();
                }
                
                // Ensure questPanelOpen field exists (default to false if not set)
                if (this.userStats.questPanelOpen === undefined) {
                    this.userStats.questPanelOpen = false;
                    await this.saveUserStats();
                }
                
                this.game.ui.updateUserStats(this.userStats);
                
                // Restore quest panel state after refresh
                if (this.game.ui && this.game.ui.restoreQuestPanelState) {
                    this.game.ui.restoreQuestPanelState();
                }
                
                console.log("🔄 User stats refreshed from Firestore");
            }
            
            // Also refresh quests
            await this.loadPlayerQuests();
        } catch (error) {
            console.error('❌ Error refreshing user stats:', error);
        }
    }
    
    // Format quest time remaining
    formatQuestTimeRemaining(endTime) {
        // Handle different time formats and timezone issues
        let end;
        if (typeof endTime === 'string') {
            // Try to parse as ISO string first
            end = new Date(endTime);
            // If parsing failed or resulted in invalid date, try alternative parsing
            if (isNaN(end.getTime())) {
                console.warn('⚠️ Invalid endTime format, trying alternative parsing:', endTime);
                // Try parsing as timestamp
                const timestamp = parseInt(endTime);
                if (!isNaN(timestamp)) {
                    end = new Date(timestamp);
                } else {
                    console.error('❌ Could not parse endTime:', endTime);
                    return { text: 'Invalid time', class: 'expired' };
                }
            }
        } else {
            end = new Date(endTime);
        }
        
        const now = new Date();
        const timeLeft = end - now;
        
        // Debug logging for quest time formatting
        console.log('⏰ Quest time formatting:', {
            endTime: endTime,
            endDate: end,
            now: now,
            timeLeft: timeLeft,
            timeLeftHours: timeLeft / (1000 * 60 * 60),
            isExpired: timeLeft <= 0
        });
        
        if (timeLeft <= 0) {
            const timeSinceExpiry = Math.abs(timeLeft);
            const expiredText = this.formatTimeSinceExpiry(timeSinceExpiry);
            console.log('❌ Quest expired:', {
                timeSinceExpiry: timeSinceExpiry,
                expiredText: expiredText
            });
            return { text: `Expired ${expiredText} ago`, class: 'expired' };
        }
        
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        let text;
        if (hours > 0) {
            text = `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            text = `${minutes}m ${seconds}s`;
        } else {
            text = `${seconds}s`;
        }
        
        let className = 'active';
        if (timeLeft < 60000) { // Less than 1 minute
            className = 'ending';
        } else if (timeLeft < 3600000) { // Less than 1 hour
            className = 'ending';
        }
        
        return { text, class: className };
    }
    
    // Format time since expiry
    formatTimeSinceExpiry(timeSinceExpiry) {
        const days = Math.floor(timeSinceExpiry / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeSinceExpiry % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeSinceExpiry % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeSinceExpiry % (1000 * 60)) / 1000);
        
        if (days > 0) {
            return `${days}d ${hours}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    
    // Method to handle external stat updates (from admin dashboard)
    handleExternalStatUpdate(updatedStats) {
        console.log("🔄 External stat update received:", updatedStats);
        
        // Update local stats
        this.userStats = { ...this.userStats, ...updatedStats };
        
        // Update UI immediately
        this.game.ui.updateUserStats(this.userStats);
        
        // Show notification of external update
        this.showStatUpdateNotification();
    }
    
    setupRealTimeUpdates() {
        console.log('🔄 Setting up real-time stat updates...');
        
        // Listen for custom events from admin dashboard
        window.addEventListener('playerStatsUpdated', (event) => {
            const { playerId, stats } = event.detail;
            console.log('📡 Received real-time stat update:', { playerId, stats });
            
            // Check if this update is for the current user
            if (this.user && (this.user.uid === playerId || this.user.email === playerId)) {
                this.handleExternalStatUpdate(stats);
            }
        });
        
        // Check localStorage for stat updates (fallback method)
        const checkForStatUpdates = () => {
            try {
                const statUpdateData = localStorage.getItem('playerStatUpdate');
                if (statUpdateData) {
                    const statUpdate = JSON.parse(statUpdateData);
                    const { playerId, stats, timestamp } = statUpdate;
                    
                    // Check if this update is recent (within last 30 seconds) and for current user
                    const isRecent = (Date.now() - timestamp) < 30000;
                    const isForCurrentUser = this.user && (this.user.uid === playerId || this.user.email === playerId);
                    
                    if (isRecent && isForCurrentUser) {
                        console.log('📡 Received localStorage stat update:', { playerId, stats });
                        
                        // Clear the update to prevent duplicate processing
                        localStorage.removeItem('playerStatUpdate');
                    }
                }
            } catch (error) {
                console.error('Error checking localStorage for stat updates:', error);
            }
        };
        
        // Check for updates every 2 seconds
        setInterval(checkForStatUpdates, 10000);
        
        // Also check immediately
        checkForStatUpdates();
        
        // Setup quest status listener
        this.setupQuestStatusListener();
        
        console.log('✅ Real-time stat updates configured');
    }
    
    // Show notification when stats are updated externally
    showStatUpdateNotification() {
        this.showBottomNotification('📊 Stats Updated! Your progress has been updated', 'success', 4000);
    }
    
    // Setup quest status listener to detect when quests are approved
    setupQuestStatusListener() {
        console.log('🔄 Setting up quest status listener...');
        
        // Listen for custom events from admin dashboard
        window.addEventListener('questStatusUpdated', (event) => {
            const { questId, newStatus } = event.detail;
            console.log('📡 Received quest status update:', { questId, newStatus });
            
            // Reload quests to reflect the new status
            this.loadPlayerQuests();
            
            // Show notification if quest was approved
            if (newStatus === 'completed') {
                this.showBottomNotification('🎉 Quest approved! You received your rewards!', 'success', 4000);
            }
        });
        
        // Check localStorage for quest updates (fallback method)
        const checkForQuestUpdates = () => {
            try {
                const questUpdateData = localStorage.getItem('questStatusUpdate');
                if (questUpdateData) {
                    const questUpdate = JSON.parse(questUpdateData);
                    const { questId, newStatus, timestamp } = questUpdate;
                    
                    // Check if this update is recent (within last 30 seconds)
                    const isRecent = (Date.now() - timestamp) < 30000;
                    
                    if (isRecent) {
                        console.log('📡 Received localStorage quest update:', { questId, newStatus });
                        this.loadPlayerQuests();
                        
                        // Show notification if quest was approved
                        if (newStatus === 'completed') {
                            this.showBottomNotification('🎉 Quest approved! You received your rewards!', 'success', 4000);
                        }
                        
                        // Clear the update to prevent duplicate processing
                        localStorage.removeItem('questStatusUpdate');
                    }
                }
            } catch (error) {
                console.error('Error checking localStorage for quest updates:', error);
            }
        };
        
        // Check for quest updates every 3 seconds
        setInterval(checkForQuestUpdates, 10000);
        
        // Also check immediately
        checkForQuestUpdates();
        
        console.log('✅ Quest status listener configured');
    }
    
    // Debug method to check what's in Firestore (call from browser console)
    async debugFirestoreUsers() {
        console.log("🔍 Debugging Firestore users collection...");
        
        try {
            const usersRef = window.collection(window.db, 'users');
            const querySnapshot = await window.getDocs(usersRef);
            
            console.log("📊 Total users in Firestore:", querySnapshot.size);
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                console.log(`👤 User ID: ${doc.id}`);
                console.log(`   Email: ${data.email}`);
                console.log(`   Name: ${data.name}`);
                console.log(`   needsAuthCreation: ${data.needsAuthCreation}`);
                console.log(`   Has Password: ${!!data.password}`);
                console.log(`   Created: ${data.createdAt}`);
                console.log("---");
            });
            
        } catch (error) {
            console.error("❌ Debug error:", error);
        }
    }
    
    // Handle quest completion by player
    async handleQuestDone(questId) {
        if (!this.user || !window.db) {
            console.error('❌ User not authenticated or database not available');
            this.showBottomNotification('❌ Error: Not authenticated', 'error');
            return;
        }
        
        try {
            console.log('🎯 Player marking quest as done:', questId);
            
            // Update quest status to 'player_done' in Firebase
            const questRef = window.doc(window.db, 'quests', questId);
            await window.updateDoc(questRef, {
                status: 'player_done',
                playerDoneBy: this.user.uid,
                playerDoneAt: new Date().toISOString()
            });
            
            console.log('✅ Quest marked as done by player');
            this.showBottomNotification('✅ Quest submitted for approval!', 'success');
            
            // Reload player quests to show updated status
            await this.loadPlayerQuests();
            
        } catch (error) {
            console.error('❌ Error marking quest as done:', error);
            this.showBottomNotification('❌ Failed to submit quest', 'error');
        }
    }
}

/**
 * FeedbackManager - Handles player feedback system
 */
class FeedbackManager {
    constructor(game) {
        this.game = game;
        this.playerFeedbacks = [];
        this.unreadCount = 0;
        this.homePosition = { x: 100, y: 100 }; // Home position on map
        this.proximityRadius = 80; // Distance to show "See Feedbacks" button
        this.isNearHome = false;
        this.feedbackButton = null;
        this.feedbackModal = null;
        
        this.init();
    }
    
    init() {
        console.log('📝 Initializing Feedback Manager...');
        this.createFeedbackButton();
        this.createFeedbackModal();
        this.loadPlayerFeedbacks();
        
        // Check for unread feedbacks every 30 seconds
        setInterval(() => {
            this.loadPlayerFeedbacks();
        }, 30000);
    }
    
    createFeedbackButton() {
        // Create "See Feedbacks" button
        this.feedbackButton = document.createElement('button');
        this.feedbackButton.id = 'feedbackButton';
        this.feedbackButton.innerHTML = '📝 See Feedbacks';
        this.feedbackButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
            transition: all 0.3s ease;
            z-index: 1000;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Add hover effects
        this.feedbackButton.addEventListener('mouseenter', () => {
            this.feedbackButton.style.transform = 'translateX(-50%) translateY(-2px)';
            this.feedbackButton.style.boxShadow = '0 6px 20px rgba(0, 123, 255, 0.4)';
        });
        
        this.feedbackButton.addEventListener('mouseleave', () => {
            this.feedbackButton.style.transform = 'translateX(-50%) translateY(0)';
            this.feedbackButton.style.boxShadow = '0 4px 15px rgba(0, 123, 255, 0.3)';
        });
        
        this.feedbackButton.addEventListener('click', () => {
            this.showFeedbackModal();
        });
        
        document.body.appendChild(this.feedbackButton);
    }
    
    createFeedbackModal() {
        // Create feedback modal
        this.feedbackModal = document.createElement('div');
        this.feedbackModal.id = 'feedbackModal';
        this.feedbackModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
        `;
        
        this.feedbackModal.innerHTML = `
            <div class="feedback-modal-content" style="
                background: rgba(255, 255, 255, 0.95);
                border-radius: 20px;
                padding: 30px;
                max-width: 90%;
                width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            ">
                <div class="feedback-modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid rgba(0, 123, 255, 0.2);
                ">
                    <h2 style="margin: 0; color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        📝 Your Feedbacks
                    </h2>
                    <button id="closeFeedbackModal" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                        padding: 5px;
                        border-radius: 50%;
                        width: 35px;
                        height: 35px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s ease;
                    ">&times;</button>
                </div>
                <div class="feedback-list" id="feedbackList">
                    <!-- Feedbacks will be loaded here -->
                </div>
            </div>
        `;
        
        document.body.appendChild(this.feedbackModal);
        
        // Add close functionality
        const closeBtn = this.feedbackModal.querySelector('#closeFeedbackModal');
        closeBtn.addEventListener('click', () => {
            this.hideFeedbackModal();
        });
        
        // Close on overlay click
        this.feedbackModal.addEventListener('click', (e) => {
            if (e.target === this.feedbackModal) {
                this.hideFeedbackModal();
            }
        });
    }
    
    async loadPlayerFeedbacks() {
        if (!this.game.auth.user || !window.db) return;
        
        try {
            console.log('📝 Loading player feedbacks...');
            
            // Get player's feedback collection
            const playerFeedbackRef = window.doc(window.db, 'playerFeedback', this.game.auth.user.uid);
            const playerFeedbackSnap = await window.getDoc(playerFeedbackRef);
            
            if (playerFeedbackSnap.exists()) {
                const data = playerFeedbackSnap.data();
                this.playerFeedbacks = data.feedbacks || [];
            } else {
                this.playerFeedbacks = [];
            }
            
            // Count unread feedbacks
            this.unreadCount = this.playerFeedbacks.filter(feedback => feedback.status === 'unread').length;
            
            console.log(`📝 Loaded ${this.playerFeedbacks.length} feedbacks, ${this.unreadCount} unread`);
            
            // Update home alert
            this.updateHomeAlert();
            
        } catch (error) {
            console.error('❌ Error loading player feedbacks:', error);
        }
    }
    
    updateHomeAlert() {
        // This will be called by the map rendering system
        // For now, we'll store the unread count for the map to use
        this.game.map.hasUnreadFeedback = this.unreadCount > 0;
    }
    
    showFeedbackModal() {
        this.feedbackModal.style.display = 'flex';
        this.renderFeedbackList();
    }
    
    hideFeedbackModal() {
        this.feedbackModal.style.display = 'none';
    }
    
    renderFeedbackList() {
        const feedbackList = this.feedbackModal.querySelector('#feedbackList');
        
        if (this.playerFeedbacks.length === 0) {
            feedbackList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                    <h3 style="margin: 0 0 10px 0;">No feedbacks yet</h3>
                    <p style="margin: 0;">You'll see feedbacks from admins here when they send them.</p>
                </div>
            `;
            return;
        }
        
        // Sort feedbacks by date (newest first)
        const sortedFeedbacks = this.playerFeedbacks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        feedbackList.innerHTML = sortedFeedbacks.map(feedback => `
            <div class="feedback-item" style="
                background: ${feedback.status === 'unread' ? 'rgba(0, 123, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
                border: 2px solid ${feedback.status === 'unread' ? 'rgba(0, 123, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)'};
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 15px;
                transition: all 0.3s ease;
                position: relative;
            ">
                <div class="feedback-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                ">
                    <div class="feedback-type" style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-weight: 600;
                        color: ${feedback.type === 'positive' ? '#28a745' : '#dc3545'};
                    ">
                        <span style="font-size: 20px;">${feedback.type === 'positive' ? '✅' : '❌'}</span>
                        <span>${feedback.type.toUpperCase()}</span>
                    </div>
                    <div class="feedback-time" style="
                        color: #666;
                        font-size: 14px;
                    ">
                        ${new Date(feedback.timestamp).toLocaleString()}
                    </div>
                </div>
                
                <div class="feedback-content">
                    <h4 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">
                        ${feedback.title}
                    </h4>
                    <p style="margin: 0 0 15px 0; color: #555; line-height: 1.5;">
                        ${feedback.message}
                    </p>
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div style="color: #666; font-size: 14px;">
                            From: <strong>${feedback.sentByName || 'Admin'}</strong>
                        </div>
                        ${feedback.status === 'unread' ? `
                            <button class="mark-read-btn" data-feedback-id="${feedback.id}" style="
                                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 20px;
                                font-size: 14px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
                            ">
                                Mark as Read
                            </button>
                        ` : `
                            <span style="
                                color: #28a745;
                                font-weight: 600;
                                font-size: 14px;
                                display: flex;
                                align-items: center;
                                gap: 5px;
                            ">
                                ✅ Read
                            </span>
                        `}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for mark as read buttons
        this.feedbackModal.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const feedbackId = e.target.getAttribute('data-feedback-id');
                this.markFeedbackAsRead(feedbackId);
            });
        });
    }
    
    async markFeedbackAsRead(feedbackId) {
        try {
            console.log('📝 Marking feedback as read:', feedbackId);
            
            // Update local data
            const feedback = this.playerFeedbacks.find(f => f.id === feedbackId);
            if (feedback) {
                feedback.status = 'read';
                feedback.readAt = new Date().toISOString();
            }
            
            // Update in Firebase
            const playerFeedbackRef = window.doc(window.db, 'playerFeedback', this.game.auth.user.uid);
            await window.updateDoc(playerFeedbackRef, {
                feedbacks: this.playerFeedbacks,
                lastUpdated: new Date().toISOString()
            });
            
            // Notify admin dashboard
            if (window.markFeedbackAsReadByPlayer) {
                await window.markFeedbackAsReadByPlayer(feedbackId, this.game.auth.user.uid);
            }
            
            // Update UI
            this.renderFeedbackList();
            this.loadPlayerFeedbacks(); // Refresh unread count
            
            // Show success notification
            this.game.auth.showBottomNotification('✅ Feedback marked as read', 'success');
            
        } catch (error) {
            console.error('❌ Error marking feedback as read:', error);
            this.game.auth.showBottomNotification('❌ Failed to mark feedback as read', 'error');
        }
    }
    
    checkProximityToHome() {
        if (!this.game.player) return;
        
        const playerX = this.game.player.x;
        const playerY = this.game.player.y;
        const distance = Math.sqrt(
            Math.pow(playerX - this.homePosition.x, 2) + 
            Math.pow(playerY - this.homePosition.y, 2)
        );
        
        const wasNearHome = this.isNearHome;
        this.isNearHome = distance <= this.proximityRadius;
        
        // Show/hide feedback button based on proximity and unread count
        if (this.isNearHome && this.unreadCount > 0) {
            this.feedbackButton.style.display = 'block';
        } else {
            this.feedbackButton.style.display = 'none';
        }
        
        // Show notification when approaching home with unread feedback
        if (this.isNearHome && !wasNearHome && this.unreadCount > 0) {
            this.game.auth.showBottomNotification(
                `📝 You have ${this.unreadCount} unread feedback${this.unreadCount > 1 ? 's' : ''}!`, 
                'info', 
                3000
            );
        }
    }
    
    update() {
        this.checkProximityToHome();
    }
}

// House Interaction Manager - Optimized for performance
class HouseInteractionManager {
    constructor(game) {
        this.game = game;
        this.houseAreas = [];
        this.interactionButton = null;
        this.currentHouse = null;
        this.lastCheckTime = 0;
        this.checkInterval = 100; // Check every 100ms instead of every frame
        this.notificationContainer = null;
        this.lastFeedbackCount = 0;
        this.houseButtonConfig = {}; // Store CSV button configuration
        this.loadHouseAreas();
        this.loadHouseButtonConfig();
        this.setupNotificationSystem();
    }
    
    loadHouseAreas() {
        // Load house interaction areas from houses.tmj file
        fetch('houses.tmj')
            .then(response => response.json())
            .then(data => {
                this.houseAreas = [];
                console.log('🏠 Loading house areas from houses.tmj...');
                
                // Process each layer (1-8) according to house placements
                data.layers.forEach((layer, layerIndex) => {
                    const layerNumber = layerIndex + 1; // Layers are 1-indexed
                    
                    if (layer.objects && layer.objects.length > 0) {
                        layer.objects.forEach((obj, index) => {
                            // Calculate interaction area bounds
                            const centerX = obj.x + (obj.width / 2);
                            const centerY = obj.y + (obj.height / 2);
                            const radius = Math.max(obj.width, obj.height) / 2;
                            
                            // Map house layers to specific names and types based on placements
                            let houseName, houseType, houseDescription;
                            switch (layerNumber) {
                                case 1: // Castle (Top Middle)
                                    houseName = 'Castle';
                                    houseType = 'castle';
                                    houseDescription = 'The royal castle at the top of the realm';
                                    break;
                                case 2: // House (Top Left)
                                    houseName = 'Top Left House';
                                    houseType = 'house';
                                    houseDescription = 'A cozy house in the top left area';
                                    break;
                                case 3: // House (Middle)
                                    houseName = 'Central House';
                                    houseType = 'house';
                                    houseDescription = 'The main house in the center';
                                    break;
                                case 4: // House (Top Right)
                                    houseName = 'Top Right House';
                                    houseType = 'house';
                                    houseDescription = 'A house in the top right area';
                                    break;
                                case 5: // House (Middle Right)
                                    houseName = 'Middle Right House';
                                    houseType = 'house';
                                    houseDescription = 'A house in the middle right area';
                                    break;
                                case 6: // House (Bottom Left)
                                    houseName = 'Bottom Left House';
                                    houseType = 'house';
                                    houseDescription = 'A house in the bottom left area';
                                    break;
                                case 7: // House (Bottom Middle)
                                    houseName = 'Bottom Middle House';
                                    houseType = 'house';
                                    houseDescription = 'A house in the bottom center';
                                    break;
                                case 8: // House (Bottom Right)
                                    houseName = 'Bottom Right House';
                                    houseType = 'house';
                                    houseDescription = 'A house in the bottom right area';
                                    break;
                                default:
                                    houseName = `House ${layerNumber}`;
                                    houseType = 'house';
                                    houseDescription = `A house in layer ${layerNumber}`;
                            }
                            
                            // Store polygon data for precise collision detection
                            const houseData = {
                                id: `house_${layerNumber}_${index}`,
                                name: houseName,
                                type: houseType,
                                description: houseDescription,
                                layerNumber: layerNumber,
                                x: obj.x,
                                y: obj.y,
                                width: obj.width,
                                height: obj.height,
                                centerX: centerX,
                                centerY: centerY,
                                radius: radius, // Keep for fallback
                                bounds: {
                                    minX: obj.x,
                                    minY: obj.y,
                                    maxX: obj.x + obj.width,
                                    maxY: obj.y + obj.height
                                }
                            };

                            // Add polygon data if available
                            if (obj.polygon && Array.isArray(obj.polygon) && obj.polygon.length >= 3) {
                                houseData.polygon = obj.polygon;
                                houseData.shape = 'polygon';
                                console.log(`🔺 House ${houseName} has polygon with ${obj.polygon.length} vertices`);
                            } else if (obj.ellipse) {
                                houseData.shape = 'ellipse';
                                houseData.ellipse = true;
                                console.log(`⭕ House ${houseName} is an ellipse`);
                            } else {
                                houseData.shape = 'rectangle';
                                console.log(`⬜ House ${houseName} is a rectangle`);
                            }

                            this.houseAreas.push(houseData);
                        });
                    }
                });
                
                console.log(`✅ Loaded ${this.houseAreas.length} house areas:`, this.houseAreas);
                
                // Debug: Log each house's details
                this.houseAreas.forEach((house, index) => {
                    console.log(`🏠 House ${index + 1}: ${house.name} at (${house.x}, ${house.y}) with radius ${house.radius}`);
                });
                
                this.createInteractionButton();
            })
            .catch(error => {
                console.error('❌ Failed to load house areas:', error);
                this.houseAreas = [];
            });
    }
    
    async loadHouseButtonConfig() {
        try {
            console.log('📊 Loading house button configuration from CSV...');
            const response = await fetch('Bouton.csv');
            const csvText = await response.text();
            
            this.houseButtonConfig = this.parseCSV(csvText);
            console.log('✅ House button configuration loaded:', this.houseButtonConfig);
        } catch (error) {
            console.error('❌ Failed to load house button config:', error);
            this.houseButtonConfig = this.getDefaultHouseConfig();
        }
    }
    
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const config = {};
        
        // Skip header lines and process data
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split('|');
            if (columns.length < 6) continue;
            
            const buttonName = columns[0].trim();
            const input1 = columns[1].trim();
            const input2 = columns[2].trim();
            const input3 = columns[3].trim();
            const input4 = columns[4].trim();
            const houseNumber = columns[5].trim();
            
            // Skip empty rows or rows without house number
            if (!houseNumber || !buttonName) continue;
            
            // Initialize house config if not exists
            if (!config[houseNumber]) {
                config[houseNumber] = {
                    name: this.getHouseName(houseNumber),
                    buttons: []
                };
            }
            
            // Add button configuration
            const inputs = [input1, input2, input3, input4].filter(input => input);
            config[houseNumber].buttons.push({
                name: buttonName,
                inputs: inputs
            });
        }
        
        return config;
    }
    
    getHouseName(houseNumber) {
        const houseNames = {
            '1': 'Castle',
            '2': 'Pointage System',
            '3': 'Ideas & Improvement',
            '5': 'Tasks & Reading',
            '6': 'Seminar Management',
            '7': 'Mission Management',
            '8': 'Photo & Video Training'
        };
        return houseNames[houseNumber] || `House ${houseNumber}`;
    }
    
    getDefaultHouseConfig() {
        return {
            '1': {
                name: 'Castle',
                buttons: [
                    { name: 'Royal Audience', inputs: [] },
                    { name: 'Castle Tour', inputs: [] }
                ]
            }
        };
    }
    
    createInteractionButton() {
        if (this.interactionButton) return;
        
        this.interactionButton = document.createElement('button');
        this.interactionButton.id = 'house-interaction-btn';
        this.interactionButton.innerHTML = '🏠 Enter House';
        this.interactionButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        `;
        
        this.interactionButton.addEventListener('click', () => {
            this.handleHouseInteraction();
        });
        
        this.interactionButton.addEventListener('mouseenter', () => {
            this.interactionButton.style.transform = 'translateX(-50%) translateY(-2px)';
            this.interactionButton.style.boxShadow = '0 6px 20px rgba(0, 122, 255, 0.4)';
        });
        
        this.interactionButton.addEventListener('mouseleave', () => {
            this.interactionButton.style.transform = 'translateX(-50%) translateY(0)';
            this.interactionButton.style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
        });
        
        document.body.appendChild(this.interactionButton);
    }
    
    update() {
        const now = Date.now();
        if (now - this.lastCheckTime < this.checkInterval) return;
        this.lastCheckTime = now;
        
        this.checkProximityToHouses();
    }
    
    checkProximityToHouses() {
        if (!this.game.player || this.houseAreas.length === 0) {
            if (this.houseAreas.length === 0) {
                console.log('🏠 No house areas loaded yet');
            }
            return;
        }
        
        const playerX = this.game.player.x;
        const playerY = this.game.player.y;
        const playerWidth = this.game.player.width;
        const playerHeight = this.game.player.height;
        let nearestHouse = null;
        
        // Check each house using the same collision detection system as walls
        for (const house of this.houseAreas) {
            let isInside = false;
            
            // Use the same collision detection methods as the wall system
            switch (house.shape) {
                case 'polygon':
                    isInside = this.checkHousePolygonCollision(playerX, playerY, playerWidth, playerHeight, house);
                    break;
                case 'ellipse':
                    isInside = this.checkHouseEllipseCollision(playerX, playerY, playerWidth, playerHeight, house);
                    break;
                case 'rectangle':
                    isInside = this.checkHouseRectangleCollision(playerX, playerY, playerWidth, playerHeight, house);
                    break;
                default:
                    // Fallback to simple distance check
                    const distance = Math.sqrt(
                        Math.pow(playerX - house.centerX, 2) + 
                        Math.pow(playerY - house.centerY, 2)
                    );
                    isInside = distance <= house.radius;
            }
            
            if (isInside) {
                nearestHouse = house;
                break; // Use first house found (can be modified for priority)
            }
        }
        
        // Debug logging
        if (nearestHouse) {
            console.log(`🏠 Player inside ${nearestHouse.name} (${nearestHouse.shape})`);
        }
        
        // Show/hide interaction button
        if (nearestHouse && nearestHouse !== this.currentHouse) {
            this.currentHouse = nearestHouse;
            this.showInteractionButton(nearestHouse);
        } else if (!nearestHouse && this.currentHouse) {
            this.currentHouse = null;
            this.hideInteractionButton();
        }
    }
    
    // House collision detection methods (reusing wall collision logic)
    checkHousePolygonCollision(playerX, playerY, playerWidth, playerHeight, house) {
        if (!house.polygon || !Array.isArray(house.polygon) || house.polygon.length < 3) {
            return false;
        }
        
        const worldPoints = house.polygon.map(point => ({
            x: house.x + point.x,
            y: house.y + point.y
        }));
        
        // Check if any player corner is inside the polygon
        const playerCorners = [
            { x: playerX, y: playerY },
            { x: playerX + playerWidth, y: playerY },
            { x: playerX, y: playerY + playerHeight },
            { x: playerX + playerWidth, y: playerY + playerHeight }
        ];
        
        for (const corner of playerCorners) {
            if (this.pointInPolygon(corner, worldPoints)) {
                return true;
            }
        }
        
        // Check if any polygon point is inside player rectangle
        for (const point of worldPoints) {
            if (point.x >= playerX && point.x <= playerX + playerWidth &&
                point.y >= playerY && point.y <= playerY + playerHeight) {
                return true;
            }
        }
        
        return false;
    }
    
    checkHouseEllipseCollision(playerX, playerY, playerWidth, playerHeight, house) {
        const centerX = house.x + house.width / 2;
        const centerY = house.y + house.height / 2;
        const radiusX = house.width / 2;
        const radiusY = house.height / 2;
        
        // Check if any player corner is inside the ellipse
        const playerCorners = [
            { x: playerX, y: playerY },
            { x: playerX + playerWidth, y: playerY },
            { x: playerX, y: playerY + playerHeight },
            { x: playerX + playerWidth, y: playerY + playerHeight }
        ];
        
        for (const corner of playerCorners) {
            const dx = corner.x - centerX;
            const dy = corner.y - centerY;
            const normalizedX = (dx * dx) / (radiusX * radiusX);
            const normalizedY = (dy * dy) / (radiusY * radiusY);
            
            if (normalizedX + normalizedY <= 1) {
                return true;
            }
        }
        
        return false;
    }
    
    checkHouseRectangleCollision(playerX, playerY, playerWidth, playerHeight, house) {
        return !(playerX + playerWidth < house.x || 
                playerX > house.x + house.width || 
                playerY + playerHeight < house.y || 
                playerY > house.y + house.height);
    }
    
    // Reuse point-in-polygon method from MapManager
    pointInPolygon(point, polygon) {
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
                (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    showInteractionButton(house) {
        if (!this.interactionButton) {
            this.createInteractionButton();
        }
        
        // Update button text with proper house name from JSON
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        const houseName = houseData ? houseData.name : house.name;
        this.interactionButton.innerHTML = `🏠 Enter ${houseName}`;
        
        // Show button with slide-up animation
        this.interactionButton.style.display = 'block';
        this.interactionButton.style.transform = 'translateX(-50%) translateY(100px)'; // Start below screen
        this.interactionButton.style.opacity = '0';
        
        // Animate slide up
        setTimeout(() => {
            this.interactionButton.style.transform = 'translateX(-50%) translateY(0)';
            this.interactionButton.style.opacity = '1';
        }, 50);
        
        console.log(`🏠 Showing interaction button for: ${house.name} (${house.type})`);
    }
    
    hideInteractionButton() {
        if (this.interactionButton) {
            // Animate slide down
            this.interactionButton.style.transform = 'translateX(-50%) translateY(100px)';
            this.interactionButton.style.opacity = '0';
            
            // Hide after animation
            setTimeout(() => {
                this.interactionButton.style.display = 'none';
            }, 300);
            
            console.log('🏠 Hiding interaction button');
        }
    }
    
    handleHouseInteraction() {
        if (!this.currentHouse) return;
        
        // Show house interaction modal
        this.showHouseModal(this.currentHouse);
    }
    
    showHouseModal(house) {
        // Get house data and name FIRST
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        const houseName = houseData ? houseData.name : house.name;
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('house-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'house-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 20px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            `;
            
            modalContent.innerHTML = `
                <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px;">${houseName}</h2>
                <p style="margin: 0 0 30px 0; color: #666; font-size: 16px;">
                    Welcome to ${houseName}! What would you like to do?
                </p>
                <div class="house-actions-container" style="display: flex; flex-direction: column; gap: 15px;">
                    ${this.getHouseActions(house)}
                </div>
                <button id="close-house-modal" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                ">×</button>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Add event listeners
            modal.querySelectorAll('.house-action-btn').forEach(btn => {
                btn.style.cssText = `
                    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                `;
                
                btn.addEventListener('click', (e) => {
                    const action = e.target.getAttribute('data-action');
                    const buttonIndex = e.target.getAttribute('data-button-index');
                    this.handleHouseAction(action, house, buttonIndex);
                });
                
                btn.addEventListener('mouseenter', () => {
                    btn.style.transform = 'translateY(-2px)';
                    btn.style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
                });
                
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = 'translateY(0)';
                    btn.style.boxShadow = 'none';
                });
            });
            
            document.getElementById('close-house-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        // House name is already set in the template above
        
        // Update the house actions container with new buttons
        const actionsContainer = modal.querySelector('.house-actions-container');
        if (actionsContainer) {
            actionsContainer.innerHTML = this.getHouseActions(house);
            
            // Reattach event listeners to new buttons
            actionsContainer.querySelectorAll('.house-action-btn').forEach(btn => {
                btn.style.cssText = `
                    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                `;
                
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const action = e.target.getAttribute('data-action');
                    const buttonIndex = e.target.getAttribute('data-section-index');
                    console.log('Button clicked:', { action, buttonIndex, house: house.layerNumber });
                    this.handleHouseAction(action, house, buttonIndex);
                });
                
                btn.addEventListener('mouseenter', () => {
                    btn.style.transform = 'translateY(-2px)';
                    btn.style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
                });
                
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = 'translateY(0)';
                    btn.style.boxShadow = 'none';
                });
            });
        }
        
        modal.style.display = 'flex';
    }
    
    getHouseActions(house) {
        // Get house data from JSON structure
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        
        if (!houseData) {
            return this.getDefaultHouseActions(house);
        }
        
        // Generate specific buttons based on house structure
        let buttons = '';
        
        if (houseData.sections && houseData.sections.length > 0) {
            // House has sections - show section buttons
            buttons = houseData.sections.map((section, index) => {
                let buttonText = section.name;
                let buttonIcon = '';
                
                // Add icons based on section type
                if (section.type === 'readonly') {
                    buttonIcon = '📊 ';
                } else if (section.conditionalGroups) {
                    buttonIcon = '⚙️ ';
                } else if (section.fields) {
                    buttonIcon = '📝 ';
                }
                
                return `
                    <div class="house-button-container">
                        <button class="house-action-btn" data-action="section" data-house="${house.layerNumber}" data-section-index="${index}">
                            ${buttonIcon}${buttonText}
                        </button>
                    </div>
                `;
            }).join('');
        } else if (houseData.fields && houseData.fields.length > 0) {
            // House has direct fields - show main form button
            buttons = `
                <div class="house-button-container">
                    <button class="house-action-btn" data-action="house-form" data-house="${house.layerNumber}">
                        📝 Fill Form
                    </button>
                </div>
            `;
        } else {
            // Fallback to default actions
            buttons = this.getDefaultHouseActions(house);
        }
        
        return buttons;
    }
    
    getDefaultHouseActions(house) {
        return `
            <button class="house-action-btn" data-action="explore">🔍 Explore</button>
            <button class="house-action-btn" data-action="rest">😴 Rest</button>
            <button class="house-action-btn" data-action="info">ℹ️ Info</button>
        `;
    }
    
    getHouseDataFromJSON(houseNumber) {
        // House data mapping based on the JSON structure - REARRANGED for correct visual positions
        // Top of screen (Y=1090) = Mission Planning, Bottom of screen (Y=256) = Login
        const houseDataMap = {
            // REARRANGED for correct visual positions (Y-axis corrected)
            // Top of screen (Y=1090) = Mission Planning, Bottom of screen (Y=256) = Login
            1: { id: 8, name: "Mission Planning", fields: [{ label: "Missions", type: "table", columns: ["Mission 1", "Mission 2", "Mission 3", "..."] }] },
            2: { 
                id: 7, 
                name: "Feedback & Tasks", 
                sections: [
                    {
                        name: "Tasks",
                        type: "readonly",
                        description: "Read-only view"
                    },
                    {
                        name: "Feedback",
                        type: "readonly",
                        description: "Read-only view"
                    },
                    {
                        name: "Customer Satisfaction",
                        type: "readonly",
                        description: "Read-only view"
                    }
                ]
            },
            3: { 
                id: 6, 
                name: "Media & Statistics", 
                sections: [
                    {
                        name: "Photo / Video",
                        fields: [
                            { label: "Training", type: "text" },
                            { label: "Group", type: "text" },
                            { label: "Date", type: "date" }
                        ]
                    },
                    {
                        name: "Defense (Final Project)",
                        fields: [
                            { label: "Training", type: "text" },
                            { label: "Group", type: "text" }
                        ]
                    },
                    {
                        name: "Payment Report",
                        fields: [
                            { label: "Training", type: "text" },
                            { label: "Group", type: "text" },
                            { label: "Payment %", type: "number" }
                        ]
                    },
                    {
                        name: "Attendance Report",
                        fields: [
                            { label: "Training", type: "text" },
                            { label: "Group", type: "text" },
                            { label: "Attendance %", type: "number" }
                        ]
                    },
                    {
                        name: "Student Count",
                        fields: [
                            { label: "Training", type: "text" },
                            { label: "Group", type: "text" },
                            { label: "Number", type: "number" }
                        ]
                    }
                ]
            },
            4: { 
                id: 5, 
                name: "Administrative Data", 
                sections: [
                    {
                        name: "Diploma",
                        fields: [
                            { label: "First Name", type: "text" },
                            { label: "Last Name", type: "text" },
                            { label: "Phone Number", type: "text" },
                            { label: "Training", type: "text" }
                        ]
                    },
                    {
                        name: "Registration Form",
                        fields: [
                            { label: "First Name", type: "text" },
                            { label: "Last Name", type: "text" },
                            { label: "Phone Number", type: "text" },
                            { label: "Training", type: "text" }
                        ]
                    },
                    {
                        name: "Pre-Registration",
                        fields: [
                            { label: "First Name", type: "text" },
                            { label: "Last Name", type: "text" },
                            { label: "Phone Number", type: "text" },
                            { label: "Training", type: "text" },
                            { label: "Province", type: "text" },
                            { label: "District", type: "text" },
                            { label: "Facebook", type: "text" }
                        ]
                    },
                    {
                        name: "Cash Register",
                        fields: [
                            { label: "Cash Fund", type: "number" },
                            { label: "Vouchers", type: "number" },
                            { label: "Expenses", type: "number" }
                        ]
                    }
                ]
            },
            5: { 
                id: 4, 
                name: "Time Tracking", 
                fields: [
                    { label: "Arrival Time", type: "time" },
                    { label: "Departure Time", type: "time" },
                    { label: "Comments", type: "textarea" }
                ]
            },
            6: { 
                id: 3, 
                name: "Analytics & History", 
                sections: [
                    {
                        name: "Improvement Ideas",
                        fields: [
                            { label: "Titles", type: "text" },
                            { label: "Details", type: "textarea" }
                        ]
                    },
                    {
                        name: "Other Players' Missions",
                        type: "readonly",
                        description: "Displays other players' missions based on player name"
                    },
                    {
                        name: "Leaderboard",
                        type: "readonly",
                        description: "Displays the current ranking"
                    },
                    {
                        name: "Coin History",
                        type: "readonly",
                        description: "Displays coin history by calendar date"
                    }
                ]
            },
            7: { 
                id: 2, 
                name: "Seminar Management", 
                sections: [
                    {
                        name: "Seminar Info",
                        fields: [
                            { label: "Titles", type: "text" },
                            { label: "Start Time", type: "time" },
                            { label: "End Time", type: "time" },
                            { label: "Number of Participants", type: "number" },
                            { label: "Number of Certificates", type: "number" }
                        ]
                    },
                    {
                        name: "Phone Info",
                        fields: [
                            { label: "Training", type: "text" },
                            { label: "Group", type: "text" },
                            { label: "Session", type: "select", options: ["1st", "2nd", "3rd", "..."] }
                        ]
                    },
                    {
                        name: "Entry Type",
                        conditionalGroups: [
                            {
                                condition: "voucher",
                                fields: [
                                    { label: "Remaining Vouchers", type: "number" },
                                    { label: "Vouchers Entered", type: "number" }
                                ]
                            },
                            {
                                condition: "registration_form",
                                fields: [
                                    { label: "Remaining Forms", type: "number" },
                                    { label: "Forms Entered", type: "number" }
                                ]
                            },
                            {
                                condition: "diploma",
                                fields: [
                                    { label: "Remaining Diplomas", type: "number" },
                                    { label: "Diplomas Entered", type: "number" }
                                ]
                            }
                        ]
                    },
                    {
                        name: "Hygiene",
                        fields: [
                            { label: "District", type: "text" },
                            { label: "Province", type: "text" },
                            { label: "Completed by", type: "text" },
                            { label: "Percentage", type: "number" }
                        ]
                    }
                ]
            },
            8: { id: 1, name: "Login", fields: [{ label: "Password", type: "password" }] }
        };
        
        return houseDataMap[houseNumber];
    }
    
    handleHouseAction(action, house, buttonIndex) {
        console.log('handleHouseAction called:', { action, house: house.layerNumber, buttonIndex });
        
        const modal = document.getElementById('house-modal');
        modal.style.display = 'none';
        
        // Get house data to determine specific button content
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        
        if (action === 'house-form') {
            console.log('Opening house dedicated form for house:', house.layerNumber);
            this.showHouseDedicatedForm(house);
        } else if (action === 'section') {
            const sectionIndex = parseInt(buttonIndex);
            console.log('Opening section form for house:', house.layerNumber, 'section:', sectionIndex);
            this.showSpecificSectionContent(house, sectionIndex);
        } else {
            console.log('Unknown action:', action);
            this.game.auth.showBottomNotification('🔍 Exploring...', 'info');
        }
    }
    
    showButtonForm(house, button) {
        // Create form modal
        let formModal = document.getElementById('button-form-modal');
        if (!formModal) {
            formModal = document.createElement('div');
            formModal.id = 'button-form-modal';
            formModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            document.body.appendChild(formModal);
        }
        
        const formContent = document.createElement('div');
        formContent.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 20px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        `;
        
        // Generate form fields based on button inputs
        const formFields = button.inputs.map((input, index) => `
            <div class="form-field">
                <label for="input-${index}">${input}:</label>
                <input type="text" id="input-${index}" name="input-${index}" placeholder="Enter ${input}" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e1e5e9;
                    border-radius: 8px;
                    font-size: 16px;
                    margin-top: 5px;
                    box-sizing: border-box;
                    transition: border-color 0.3s ease;
                ">
            </div>
        `).join('');
        
        formContent.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;">
                ${button.name}
            </h2>
            <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; text-align: center;">
                Fill in the required information:
            </p>
            <form id="button-form" style="display: flex; flex-direction: column; gap: 20px;">
                ${formFields}
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                    <button type="button" id="cancel-form" style="
                        background: rgba(255, 59, 48, 0.1);
                        color: #ff3b30;
                        border: 2px solid rgba(255, 59, 48, 0.3);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Cancel</button>
                    <button type="submit" style="
                        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Submit</button>
                </div>
            </form>
            <button id="close-form-modal" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            ">×</button>
        `;
        
        formModal.innerHTML = '';
        formModal.appendChild(formContent);
        formModal.style.display = 'flex';
        
        // Add event listeners
        document.getElementById('cancel-form').addEventListener('click', () => {
            formModal.style.display = 'none';
        });
        
        document.getElementById('close-form-modal').addEventListener('click', () => {
            formModal.style.display = 'none';
        });
        
        formModal.addEventListener('click', (e) => {
            if (e.target === formModal) {
                formModal.style.display = 'none';
            }
        });
        
        document.getElementById('button-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmission(house, button, formModal);
        });
        
        // Add input focus effects
        formContent.querySelectorAll('input').forEach(input => {
            input.addEventListener('focus', () => {
                input.style.borderColor = '#007AFF';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#e1e5e9';
            });
        });
    }
    
    handleFormSubmission(house, button, formModal) {
        const form = document.getElementById('button-form');
        const formData = new FormData(form);
        const data = {};
        
        // Collect form data
        button.inputs.forEach((input, index) => {
            const value = document.getElementById(`input-${index}`).value;
            data[input] = value;
        });
        
        console.log(`📝 Form submitted for ${button.name} in ${house.name}:`, data);
        
        // Show success message
        this.game.auth.showBottomNotification(`✅ ${button.name} submitted successfully!`, 'success');
        
        // Close modal
        formModal.style.display = 'none';
        
        // Here you can add logic to save the data to Firebase or handle it as needed
        // For now, we just log it and show a success message
    }
    
    showSectionForm(house, sectionIndex) {
        console.log('showSectionForm called:', { house: house.layerNumber, sectionIndex });
        
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        if (!houseData || !houseData.sections || !houseData.sections[sectionIndex]) {
            console.log('Section not found:', { houseData, sections: houseData?.sections, sectionIndex });
            this.game.auth.showBottomNotification('❌ Section not found', 'error');
            return;
        }
        
        const section = houseData.sections[sectionIndex];
        
        // Handle readonly sections
        if (section.type === 'readonly') {
            this.showReadonlySection(house, section);
            return;
        }
        
        // Handle conditional groups (like Entry Type)
        if (section.conditionalGroups) {
            this.showConditionalSection(house, section);
            return;
        }
        
        // Handle regular sections with fields
        if (section.fields && section.fields.length > 0) {
            this.showFieldForm(house, section);
            return;
        }
        
        this.game.auth.showBottomNotification('❌ No form available for this section', 'error');
    }
    
    showSpecificSectionContent(house, sectionIndex) {
        console.log('showSpecificSectionContent called:', { house: house.layerNumber, sectionIndex });
        
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        if (!houseData || !houseData.sections || !houseData.sections[sectionIndex]) {
            console.log('Section not found:', { houseData, sections: houseData?.sections, sectionIndex });
            this.game.auth.showBottomNotification('❌ Section not found', 'error');
            return;
        }
        
        const section = houseData.sections[sectionIndex];
        const houseName = houseData.name;
        const sectionName = section.name;
        
        // Create unique modal for this specific section
        let sectionModal = document.getElementById(`section-modal-${house.layerNumber}-${sectionIndex}`);
        if (!sectionModal) {
            sectionModal = document.createElement('div');
            sectionModal.id = `section-modal-${house.layerNumber}-${sectionIndex}`;
            sectionModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            document.body.appendChild(sectionModal);
        }
        
        const sectionContent = document.createElement('div');
        sectionContent.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 20px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        `;
        
        // Generate specific content based on section type
        let contentHTML = '';
        
        if (section.type === 'readonly') {
            contentHTML = this.createReadonlySectionContent(section, houseName);
        } else if (section.conditionalGroups) {
            contentHTML = this.createConditionalSectionContent(section, houseName);
        } else if (section.fields) {
            contentHTML = this.createFieldSectionContent(section, houseName);
        } else {
            contentHTML = `<div style="text-align: center; color: #666;">No content available for this section.</div>`;
        }
        
        sectionContent.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;">
                ${houseName} - ${sectionName}
            </h2>
            <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; text-align: center;">
                ${this.getSectionDescription(section)}
            </p>
            <div class="section-content">
                ${contentHTML}
            </div>
            <div style="display: flex; justify-content: center; margin-top: 30px;">
                <button id="close-section-${house.layerNumber}-${sectionIndex}" style="
                    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">Close</button>
            </div>
        `;
        
        sectionModal.innerHTML = '';
        sectionModal.appendChild(sectionContent);
        sectionModal.style.display = 'flex';
        
        // Add event listeners
        document.getElementById(`close-section-${house.layerNumber}-${sectionIndex}`).addEventListener('click', () => {
            sectionModal.style.display = 'none';
        });
        
        sectionModal.addEventListener('click', (e) => {
            if (e.target === sectionModal) {
                sectionModal.style.display = 'none';
            }
        });
        
        // Add input focus effects for any form elements
        sectionContent.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('focus', () => {
                input.style.borderColor = '#007AFF';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#e1e5e9';
            });
        });
        
        console.log('Section modal created for:', { house: houseName, section: sectionName });
    }
    
    createReadonlySectionContent(section, houseName) {
        return `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; border-left: 4px solid #8E8E93;">
                <h3 style="margin: 0 0 15px 0; color: #1d1d1f;">${section.name}</h3>
                <p style="margin: 0 0 20px 0; color: #666;">${section.description}</p>
                
                <div style="overflow-x: auto; margin-bottom: 20px;">
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e1e5e9; border-radius: 8px; overflow: hidden; background: white;">
                        <thead>
                            <tr style="background: #8E8E93; color: white;">
                                <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Data Type</th>
                                <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Information</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #e1e5e9; background: #f8f9fa; font-weight: 600; width: 30%;">Status</td>
                                <td style="padding: 12px; border: 1px solid #e1e5e9; background: white; color: #999; font-style: italic;">
                                    📊 Data will be displayed here when available
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #e1e5e9; background: #f8f9fa; font-weight: 600;">Last Updated</td>
                                <td style="padding: 12px; border: 1px solid #e1e5e9; background: white; color: #999; font-style: italic;">
                                    No data available
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #e1e5e9; background: #f8f9fa; font-weight: 600;">Records</td>
                                <td style="padding: 12px; border: 1px solid #e1e5e9; background: white; color: #999; font-style: italic;">
                                    0 entries
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button style="
                        background: linear-gradient(135deg, #8E8E93 0%, #6D6D70 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Refresh Data</button>
                </div>
            </div>
        `;
    }
    
    createConditionalSectionContent(section, houseName) {
        const conditionOptions = section.conditionalGroups.map(group => 
            `<option value="${group.condition}">${group.condition.replace('_', ' ').toUpperCase()}</option>`
        ).join('');
        
        return `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; border-left: 4px solid #FF9500;">
                <h3 style="margin: 0 0 15px 0; color: #1d1d1f;">${section.name}</h3>
                <p style="margin: 0 0 20px 0; color: #666;">Select the entry type and fill in the required information:</p>
                
                <form id="conditional-form-${section.name.replace(/\s+/g, '-')}" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="overflow-x: auto; margin-bottom: 20px;">
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e1e5e9; border-radius: 8px; overflow: hidden; background: white;">
                            <thead>
                                <tr style="background: #FF9500; color: white;">
                                    <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Entry Type</th>
                                    <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Selection</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #e1e5e9; background: #f8f9fa; font-weight: 600; width: 30%;">Entry Type</td>
                                    <td style="padding: 8px; border: 1px solid #e1e5e9; background: white;">
                                        <select id="entry-type-${section.name.replace(/\s+/g, '-')}" name="entry-type" style="
                                            width: 100%;
                                            padding: 8px;
                                            border: 1px solid #e1e5e9;
                                            border-radius: 4px;
                                            font-size: 14px;
                                            box-sizing: border-box;
                                            transition: border-color 0.3s ease;
                                        ">
                                            <option value="">Select Entry Type</option>
                                            ${conditionOptions}
                                        </select>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div id="conditional-fields-${section.name.replace(/\s+/g, '-')}" style="display: none;">
                        <!-- Dynamic fields table will be added here -->
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
                        <button type="button" id="cancel-conditional-${section.name.replace(/\s+/g, '-')}" style="
                            background: rgba(255, 59, 48, 0.1);
                            color: #ff3b30;
                            border: 2px solid rgba(255, 59, 48, 0.3);
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        ">Cancel</button>
                        <button type="submit" style="
                            background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        ">Submit Data</button>
                    </div>
                </form>
            </div>
        `;
    }
    
    createFieldSectionContent(section, houseName) {
        // Create a table-based form for this section
        const tableRows = section.fields.map((field, index) => {
            const fieldId = `field-${index}`;
            const baseInputStyle = `
                width: 100%;
                padding: 8px;
                border: 1px solid #e1e5e9;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
                transition: border-color 0.3s ease;
            `;
            
            let inputElement = '';
            
            switch (field.type) {
                case 'password':
                    inputElement = `<input type="password" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
                    break;
                case 'time':
                    inputElement = `<input type="time" id="${fieldId}" name="${fieldId}" style="${baseInputStyle}">`;
                    break;
                case 'date':
                    inputElement = `<input type="date" id="${fieldId}" name="${fieldId}" style="${baseInputStyle}">`;
                    break;
                case 'number':
                    inputElement = `<input type="number" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
                    break;
                case 'select':
                    const options = field.options ? field.options.map(option => `<option value="${option}">${option}</option>`).join('') : '';
                    inputElement = `<select id="${fieldId}" name="${fieldId}" style="${baseInputStyle}"><option value="">Select ${field.label}</option>${options}</select>`;
                    break;
                case 'textarea':
                    inputElement = `<textarea id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" rows="2" style="${baseInputStyle}"></textarea>`;
                    break;
                default:
                    inputElement = `<input type="text" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
            }
            
            return `
                <tr>
                    <td style="padding: 12px; border: 1px solid #e1e5e9; background: #f8f9fa; font-weight: 600; width: 30%;">${field.label}</td>
                    <td style="padding: 8px; border: 1px solid #e1e5e9; background: white;">${inputElement}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; border-left: 4px solid #007AFF;">
                <h3 style="margin: 0 0 15px 0; color: #1d1d1f;">${section.name}</h3>
                <p style="margin: 0 0 20px 0; color: #666;">Fill in the required information in the table below:</p>
                
                <div style="overflow-x: auto; margin-bottom: 20px;">
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e1e5e9; border-radius: 8px; overflow: hidden; background: white;">
                        <thead>
                            <tr style="background: #007AFF; color: white;">
                                <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Field</th>
                                <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                
                <form id="section-form-${section.name.replace(/\s+/g, '-')}" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button type="button" id="cancel-section-${section.name.replace(/\s+/g, '-')}" style="
                            background: rgba(255, 59, 48, 0.1);
                            color: #ff3b30;
                            border: 2px solid rgba(255, 59, 48, 0.3);
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        ">Cancel</button>
                        <button type="submit" style="
                            background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        ">Submit Data</button>
                    </div>
                </form>
            </div>
        `;
    }
    
    getSectionDescription(section) {
        if (section.type === 'readonly') {
            return 'This is a read-only section for viewing data.';
        } else if (section.conditionalGroups) {
            return 'Select an entry type and fill in the corresponding fields.';
        } else if (section.fields) {
            return 'Fill in the required information for this section.';
        } else {
            return 'Access the content for this section.';
        }
    }
    
    createSectionedHouseTableForm(houseData) {
        // Create a comprehensive table form with all sections
        let allFields = [];
        
        houseData.sections.forEach((section, sectionIndex) => {
            if (section.type === 'readonly') {
                // Add readonly section info
                allFields.push({
                    type: 'readonly-info',
                    sectionName: section.name,
                    description: section.description
                });
            } else if (section.conditionalGroups) {
                // Add conditional section
                allFields.push({
                    type: 'conditional-section',
                    sectionName: section.name,
                    conditionalGroups: section.conditionalGroups
                });
            } else if (section.fields) {
                // Add regular fields with section header
                allFields.push({
                    type: 'section-header',
                    sectionName: section.name
                });
                section.fields.forEach(field => {
                    allFields.push(field);
                });
            }
        });
        
        return allFields.map((field, index) => {
            if (field.type === 'readonly-info') {
                return `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #8E8E93;">
                        <h4 style="margin: 0 0 5px 0; color: #1d1d1f;">${field.sectionName}</h4>
                        <p style="margin: 0; color: #666; font-size: 14px;">${field.description}</p>
                    </div>
                `;
            } else if (field.type === 'conditional-section') {
                return this.createConditionalSectionContent(field, index);
            } else if (field.type === 'section-header') {
                return `
                    <div style="background: #007AFF; color: white; padding: 10px 15px; border-radius: 8px; margin: 15px 0 10px 0; font-weight: 600;">
                        ${field.sectionName}
                    </div>
                `;
            } else {
                return this.createTableRowField(field, index);
            }
        }).join('');
    }
    
    createDirectHouseTableForm(houseData) {
        const tableRows = houseData.fields.map((field, index) => {
            return this.createTableRowField(field, index);
        }).join('');
        
        return `
            <div style="overflow-x: auto; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e1e5e9; border-radius: 8px; overflow: hidden; background: white;">
                    <thead>
                        <tr style="background: #007AFF; color: white;">
                            <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Field</th>
                            <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left; font-weight: 600;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    createTableRowField(field, index) {
        const fieldId = `field-${index}`;
        const baseInputStyle = `
            width: 100%;
            padding: 8px;
            border: 1px solid #e1e5e9;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
            transition: border-color 0.3s ease;
        `;
        
        let inputElement = '';
        
        switch (field.type) {
            case 'password':
                inputElement = `<input type="password" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
                break;
            case 'time':
                inputElement = `<input type="time" id="${fieldId}" name="${fieldId}" style="${baseInputStyle}">`;
                break;
            case 'date':
                inputElement = `<input type="date" id="${fieldId}" name="${fieldId}" style="${baseInputStyle}">`;
                break;
            case 'number':
                inputElement = `<input type="number" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
                break;
            case 'select':
                const options = field.options ? field.options.map(option => `<option value="${option}">${option}</option>`).join('') : '';
                inputElement = `<select id="${fieldId}" name="${fieldId}" style="${baseInputStyle}"><option value="">Select ${field.label}</option>${options}</select>`;
                break;
            case 'textarea':
                inputElement = `<textarea id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" rows="2" style="${baseInputStyle}"></textarea>`;
                break;
            case 'table':
                // Handle table type (for Mission Planning)
                inputElement = this.createTableField(field, fieldId);
                break;
            default:
                inputElement = `<input type="text" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
        }
        
        return `
            <tr>
                <td style="padding: 12px; border: 1px solid #e1e5e9; background: #f8f9fa; font-weight: 600; width: 30%;">${field.label}</td>
                <td style="padding: 8px; border: 1px solid #e1e5e9; background: white;">${inputElement}</td>
            </tr>
        `;
    }
    
    showHouseDedicatedForm(house) {
        console.log('showHouseDedicatedForm called:', { house: house.layerNumber });
        
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        if (!houseData) {
            console.log('House data not found for house:', house.layerNumber);
            this.game.auth.showBottomNotification('❌ House data not found', 'error');
            return;
        }
        
        // Create dedicated form modal for this specific house
        let formModal = document.getElementById('house-dedicated-form-modal');
        if (!formModal) {
            formModal = document.createElement('div');
            formModal.id = 'house-dedicated-form-modal';
            formModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            document.body.appendChild(formModal);
        }
        
        const formContent = document.createElement('div');
        formContent.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 20px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        `;
        
        // Generate form content based on house structure
        let formHTML = '';
        
        if (houseData.sections && houseData.sections.length > 0) {
            // House has sections - create combined table form
            formHTML = this.createSectionedHouseTableForm(houseData);
        } else if (houseData.fields && houseData.fields.length > 0) {
            // House has direct fields - create simple table form
            formHTML = this.createDirectHouseTableForm(houseData);
        } else {
            formHTML = '<div style="text-align: center; color: #666;">No form available for this house.</div>';
        }
        
        formContent.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;">
                ${houseData.name}
            </h2>
            <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; text-align: center;">
                Fill in the required information:
            </p>
            <form id="house-dedicated-form" style="display: flex; flex-direction: column; gap: 20px;">
                ${formHTML}
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                    <button type="button" id="cancel-house-form" style="
                        background: rgba(255, 59, 48, 0.1);
                        color: #ff3b30;
                        border: 2px solid rgba(255, 59, 48, 0.3);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Cancel</button>
                    <button type="submit" style="
                        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Submit</button>
                </div>
            </form>
            <button id="close-house-form-modal" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            ">×</button>
        `;
        
        formModal.innerHTML = '';
        formModal.appendChild(formContent);
        formModal.style.display = 'flex';
        
        // Add event listeners
        document.getElementById('cancel-house-form').addEventListener('click', () => {
            formModal.style.display = 'none';
        });
        
        document.getElementById('close-house-form-modal').addEventListener('click', () => {
            formModal.style.display = 'none';
        });
        
        formModal.addEventListener('click', (e) => {
            if (e.target === formModal) {
                formModal.style.display = 'none';
            }
        });
        
        document.getElementById('house-dedicated-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleHouseDedicatedFormSubmission(house, houseData, formModal);
        });
        
        // Add input focus effects
        formContent.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('focus', () => {
                input.style.borderColor = '#007AFF';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#e1e5e9';
            });
        });
    }
    
    createSectionedHouseForm(houseData) {
        // Create a form with all sections combined
        let allFields = [];
        
        houseData.sections.forEach((section, sectionIndex) => {
            if (section.type === 'readonly') {
                // Add readonly section info
                allFields.push({
                    type: 'readonly-info',
                    sectionName: section.name,
                    description: section.description
                });
            } else if (section.conditionalGroups) {
                // Add conditional section
                allFields.push({
                    type: 'conditional-section',
                    sectionName: section.name,
                    conditionalGroups: section.conditionalGroups
                });
            } else if (section.fields) {
                // Add regular fields with section header
                allFields.push({
                    type: 'section-header',
                    sectionName: section.name
                });
                section.fields.forEach(field => {
                    allFields.push(field);
                });
            }
        });
        
        return allFields.map((field, index) => {
            if (field.type === 'readonly-info') {
                return `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #8E8E93;">
                        <h4 style="margin: 0 0 5px 0; color: #1d1d1f;">${field.sectionName}</h4>
                        <p style="margin: 0; color: #666; font-size: 14px;">${field.description}</p>
                    </div>
                `;
            } else if (field.type === 'conditional-section') {
                return this.createConditionalSectionHTML(field, index);
            } else if (field.type === 'section-header') {
                return `
                    <div style="background: #007AFF; color: white; padding: 10px 15px; border-radius: 8px; margin: 15px 0 10px 0; font-weight: 600;">
                        ${field.sectionName}
                    </div>
                `;
            } else {
                return this.createFormField(field, index);
            }
        }).join('');
    }
    
    createDirectHouseForm(houseData) {
        return houseData.fields.map((field, index) => {
            return this.createFormField(field, index);
        }).join('');
    }
    
    createConditionalSectionHTML(section, index) {
        const conditionOptions = section.conditionalGroups.map(group => 
            `<option value="${group.condition}">${group.condition.replace('_', ' ').toUpperCase()}</option>`
        ).join('');
        
        return `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #FF9500;">
                <h4 style="margin: 0 0 10px 0; color: #1d1d1f;">${section.sectionName}</h4>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #1d1d1f;">Entry Type:</label>
                <select id="entry-type-${index}" name="entry-type-${index}" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e1e5e9;
                    border-radius: 8px;
                    font-size: 16px;
                    margin-bottom: 10px;
                    box-sizing: border-box;
                    transition: border-color 0.3s ease;
                ">
                    <option value="">Select Entry Type</option>
                    ${conditionOptions}
                </select>
                <div id="conditional-fields-${index}" style="display: none;">
                    <!-- Dynamic fields will be added here -->
                </div>
            </div>
        `;
    }
    
    handleHouseDedicatedFormSubmission(house, houseData, formModal) {
        const form = document.getElementById('house-dedicated-form');
        const formData = new FormData(form);
        const data = {};
        
        // Collect all form data
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.value && input.name) {
                data[input.name] = input.value;
            }
        });
        
        console.log(`📝 House form submitted for ${houseData.name}:`, data);
        
        // Show success message
        this.game.auth.showBottomNotification(`✅ ${houseData.name} submitted successfully!`, 'success');
        
        // Close modal
        formModal.style.display = 'none';
    }
    
    showHouseForm(house) {
        const houseData = this.getHouseDataFromJSON(house.layerNumber);
        if (!houseData || !houseData.fields) {
            this.game.auth.showBottomNotification('❌ No form available for this house', 'error');
            return;
        }
        
        this.showFieldForm(house, houseData);
    }
    
    showFieldForm(house, section) {
        // Create form modal
        let formModal = document.getElementById('section-form-modal');
        if (!formModal) {
            formModal = document.createElement('div');
            formModal.id = 'section-form-modal';
            formModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            document.body.appendChild(formModal);
        }
        
        const formContent = document.createElement('div');
        formContent.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 20px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        `;
        
        // Generate form fields based on section fields
        const formFields = section.fields.map((field, index) => {
            return this.createFormField(field, index);
        }).join('');
        
        formContent.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;">
                ${section.name}
            </h2>
            <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; text-align: center;">
                Fill in the required information:
            </p>
            <form id="section-form" style="display: flex; flex-direction: column; gap: 20px;">
                ${formFields}
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                    <button type="button" id="cancel-section-form" style="
                        background: rgba(255, 59, 48, 0.1);
                        color: #ff3b30;
                        border: 2px solid rgba(255, 59, 48, 0.3);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Cancel</button>
                    <button type="submit" style="
                        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Submit</button>
                </div>
            </form>
            <button id="close-section-form-modal" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            ">×</button>
        `;
        
        formModal.innerHTML = '';
        formModal.appendChild(formContent);
        formModal.style.display = 'flex';
        
        // Add event listeners
        document.getElementById('cancel-section-form').addEventListener('click', () => {
            formModal.style.display = 'none';
        });
        
        document.getElementById('close-section-form-modal').addEventListener('click', () => {
            formModal.style.display = 'none';
        });
        
        formModal.addEventListener('click', (e) => {
            if (e.target === formModal) {
                formModal.style.display = 'none';
            }
        });
        
        document.getElementById('section-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSectionFormSubmission(house, section, formModal);
        });
        
        // Add input focus effects
        formContent.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('focus', () => {
                input.style.borderColor = '#007AFF';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#e1e5e9';
            });
        });
    }
    
    createFormField(field, index) {
        const fieldId = `field-${index}`;
        const baseInputStyle = `
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            margin-top: 5px;
            box-sizing: border-box;
            transition: border-color 0.3s ease;
        `;
        
        let inputElement = '';
        
        switch (field.type) {
            case 'password':
                inputElement = `<input type="password" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
                break;
            case 'time':
                inputElement = `<input type="time" id="${fieldId}" name="${fieldId}" style="${baseInputStyle}">`;
                break;
            case 'date':
                inputElement = `<input type="date" id="${fieldId}" name="${fieldId}" style="${baseInputStyle}">`;
                break;
            case 'number':
                inputElement = `<input type="number" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
                break;
            case 'select':
                const options = field.options ? field.options.map(option => `<option value="${option}">${option}</option>`).join('') : '';
                inputElement = `<select id="${fieldId}" name="${fieldId}" style="${baseInputStyle}"><option value="">Select ${field.label}</option>${options}</select>`;
                break;
            case 'textarea':
                inputElement = `<textarea id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" rows="4" style="${baseInputStyle}"></textarea>`;
                break;
            case 'table':
                // Handle table type (for Mission Planning)
                inputElement = this.createTableField(field, fieldId);
                break;
            default:
                inputElement = `<input type="text" id="${fieldId}" name="${fieldId}" placeholder="Enter ${field.label}" style="${baseInputStyle}">`;
        }
        
        return `
            <div class="form-field">
                <label for="${fieldId}" style="display: block; margin-bottom: 5px; font-weight: 600; color: #1d1d1f;">${field.label}:</label>
                ${inputElement}
            </div>
        `;
    }
    
    createTableField(field, fieldId) {
        const columns = field.columns || [];
        const tableRows = columns.map((column, index) => `
            <tr>
                <td style="padding: 8px; border: 1px solid #e1e5e9; background: #f8f9fa; font-weight: 600;">${column}</td>
                <td style="padding: 8px; border: 1px solid #e1e5e9;">
                    <input type="text" name="${fieldId}_${index}" placeholder="Enter ${column}" style="width: 100%; border: none; padding: 4px; background: transparent;">
                </td>
            </tr>
        `).join('');
        
        return `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e1e5e9; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left;">Mission</th>
                            <th style="padding: 12px; border: 1px solid #e1e5e9; text-align: left;">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    showReadonlySection(house, section) {
        // Create readonly modal
        let readonlyModal = document.getElementById('readonly-modal');
        if (!readonlyModal) {
            readonlyModal = document.createElement('div');
            readonlyModal.id = 'readonly-modal';
            readonlyModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            document.body.appendChild(readonlyModal);
        }
        
        const readonlyContent = document.createElement('div');
        readonlyContent.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 20px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        `;
        
        readonlyContent.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;">
                ${section.name}
            </h2>
            <div style="text-align: center; color: #666; font-size: 16px; margin-bottom: 30px;">
                ${section.description || 'This is a read-only section.'}
            </div>
            <div style="text-align: center; color: #999; font-style: italic;">
                📊 Data will be displayed here when available
            </div>
            <div style="display: flex; justify-content: center; margin-top: 30px;">
                <button id="close-readonly-modal" style="
                    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">Close</button>
            </div>
        `;
        
        readonlyModal.innerHTML = '';
        readonlyModal.appendChild(readonlyContent);
        readonlyModal.style.display = 'flex';
        
        // Add event listeners
        document.getElementById('close-readonly-modal').addEventListener('click', () => {
            readonlyModal.style.display = 'none';
        });
        
        readonlyModal.addEventListener('click', (e) => {
            if (e.target === readonlyModal) {
                readonlyModal.style.display = 'none';
            }
        });
    }
    
    showConditionalSection(house, section) {
        // Create conditional modal
        let conditionalModal = document.getElementById('conditional-modal');
        if (!conditionalModal) {
            conditionalModal = document.createElement('div');
            conditionalModal.id = 'conditional-modal';
            conditionalModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 3000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            document.body.appendChild(conditionalModal);
        }
        
        const conditionalContent = document.createElement('div');
        conditionalContent.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 20px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        `;
        
        // Create condition selector
        const conditionOptions = section.conditionalGroups.map(group => 
            `<option value="${group.condition}">${group.condition.replace('_', ' ').toUpperCase()}</option>`
        ).join('');
        
        conditionalContent.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;">
                ${section.name}
            </h2>
            <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; text-align: center;">
                Select the entry type:
            </p>
            <form id="conditional-form" style="display: flex; flex-direction: column; gap: 20px;">
                <div class="form-field">
                    <label for="entry-type" style="display: block; margin-bottom: 5px; font-weight: 600; color: #1d1d1f;">Entry Type:</label>
                    <select id="entry-type" name="entry-type" style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e1e5e9;
                        border-radius: 8px;
                        font-size: 16px;
                        margin-top: 5px;
                        box-sizing: border-box;
                        transition: border-color 0.3s ease;
                    ">
                        <option value="">Select Entry Type</option>
                        ${conditionOptions}
                    </select>
                </div>
                <div id="conditional-fields" style="display: none;">
                    <!-- Dynamic fields will be added here -->
                </div>
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                    <button type="button" id="cancel-conditional-form" style="
                        background: rgba(255, 59, 48, 0.1);
                        color: #ff3b30;
                        border: 2px solid rgba(255, 59, 48, 0.3);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Cancel</button>
                    <button type="submit" style="
                        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Submit</button>
                </div>
            </form>
            <button id="close-conditional-modal" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            ">×</button>
        `;
        
        conditionalModal.innerHTML = '';
        conditionalModal.appendChild(conditionalContent);
        conditionalModal.style.display = 'flex';
        
        // Add event listeners
        document.getElementById('cancel-conditional-form').addEventListener('click', () => {
            conditionalModal.style.display = 'none';
        });
        
        document.getElementById('close-conditional-modal').addEventListener('click', () => {
            conditionalModal.style.display = 'none';
        });
        
        conditionalModal.addEventListener('click', (e) => {
            if (e.target === conditionalModal) {
                conditionalModal.style.display = 'none';
            }
        });
        
        // Handle entry type selection
        document.getElementById('entry-type').addEventListener('change', (e) => {
            const selectedType = e.target.value;
            const conditionalFields = document.getElementById('conditional-fields');
            
            if (selectedType) {
                const selectedGroup = section.conditionalGroups.find(group => group.condition === selectedType);
                if (selectedGroup && selectedGroup.fields) {
                    const fieldsHTML = selectedGroup.fields.map((field, index) => {
                        return this.createFormField(field, `conditional-${index}`);
                    }).join('');
                    
                    conditionalFields.innerHTML = fieldsHTML;
                    conditionalFields.style.display = 'block';
                }
            } else {
                conditionalFields.style.display = 'none';
            }
        });
        
        document.getElementById('conditional-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleConditionalFormSubmission(house, section, conditionalModal);
        });
    }
    
    handleSectionFormSubmission(house, section, formModal) {
        const form = document.getElementById('section-form');
        const formData = new FormData(form);
        const data = {};
        
        // Collect form data
        section.fields.forEach((field, index) => {
            const value = document.getElementById(`field-${index}`).value;
            data[field.label] = value;
        });
        
        console.log(`📝 Form submitted for ${section.name} in ${house.name}:`, data);
        
        // Show success message
        this.game.auth.showBottomNotification(`✅ ${section.name} submitted successfully!`, 'success');
        
        // Close modal
        formModal.style.display = 'none';
    }
    
    handleConditionalFormSubmission(house, section, formModal) {
        const form = document.getElementById('conditional-form');
        const formData = new FormData(form);
        const data = {};
        
        // Get selected entry type
        const entryType = document.getElementById('entry-type').value;
        data['Entry Type'] = entryType;
        
        // Collect conditional fields data
        const conditionalFields = document.getElementById('conditional-fields');
        const inputs = conditionalFields.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.value) {
                data[input.placeholder.replace('Enter ', '')] = input.value;
            }
        });
        
        console.log(`📝 Conditional form submitted for ${section.name} in ${house.name}:`, data);
        
        // Show success message
        this.game.auth.showBottomNotification(`✅ ${section.name} submitted successfully!`, 'success');
        
        // Close modal
        formModal.style.display = 'none';
    }
    
    handleHomeActions(action, house) {
        switch (action) {
            case 'view-feedbacks':
                this.showHomeFeedbacksTable();
                break;
            case 'view-missions':
                this.showHomeMissionsTable();
                break;
            case 'view-all':
                this.showHomeOverviewTable();
                break;
        }
    }
    
    handleFeedbackActions(action, house) {
        switch (action) {
            case 'view-feedback':
                // Open the existing feedback modal
                if (this.game.feedback) {
                    this.game.feedback.showFeedbackModal();
                } else {
                    this.game.auth.showBottomNotification('📝 Opening feedback...', 'info');
                }
                break;
            case 'feedback-history':
                this.game.auth.showBottomNotification('📊 Feedback history coming soon!', 'info');
                break;
            case 'feedback-settings':
                this.game.auth.showBottomNotification('⚙️ Feedback settings coming soon!', 'info');
                break;
        }
    }
    
    handleMissionActions(action, house) {
        switch (action) {
            case 'submit-mission':
                this.showMissionSubmissionModal();
                break;
            case 'mission-status':
                this.game.auth.showBottomNotification('📈 Mission status coming soon!', 'info');
                break;
            case 'mission-history':
                this.game.auth.showBottomNotification('📚 Mission history coming soon!', 'info');
                break;
        }
    }
    
    handleHistoryActions(action, house) {
        // All history actions are disabled for now
        this.game.auth.showBottomNotification('📖 History features coming soon!', 'info');
    }
    
    showMissionSubmissionModal() {
        // Create mission submission modal
        let modal = document.getElementById('mission-submission-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mission-submission-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 20px;
                max-width: 500px;
                width: 90%;
                text-align: center;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            `;
            
            modalContent.innerHTML = `
                <h2 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px;">📋 Submit Daily Mission</h2>
                <p style="margin: 0 0 30px 0; color: #666; font-size: 16px;">
                    Submit your completed daily mission for review.
                </p>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button class="mission-action-btn" data-action="submit-photo">📸 Submit Photo Evidence</button>
                    <button class="mission-action-btn" data-action="submit-text">📝 Submit Text Description</button>
                    <button class="mission-action-btn" data-action="submit-link">🔗 Submit Link/URL</button>
                </div>
                <button id="close-mission-modal" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                ">×</button>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Add event listeners
            modal.querySelectorAll('.mission-action-btn').forEach(btn => {
                btn.style.cssText = `
                    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                `;
                
                btn.addEventListener('click', (e) => {
                    const action = e.target.getAttribute('data-action');
                    this.handleMissionSubmission(action);
                });
                
                btn.addEventListener('mouseenter', () => {
                    btn.style.transform = 'translateY(-2px)';
                    btn.style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
                });
                
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = 'translateY(0)';
                    btn.style.boxShadow = 'none';
                });
            });
            
            document.getElementById('close-mission-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        modal.style.display = 'flex';
    }
    
    handleMissionSubmission(action) {
        const modal = document.getElementById('mission-submission-modal');
        modal.style.display = 'none';
        
        switch (action) {
            case 'submit-photo':
                this.showMissionInputModal('photo', '📸 Submit Photo Evidence');
                break;
            case 'submit-text':
                this.showMissionInputModal('text', '📝 Submit Text Description');
                break;
            case 'submit-link':
                this.showMissionInputModal('link', '🔗 Submit Link/URL');
                break;
        }
    }
    
    showMissionInputModal(type, title) {
        // Create mission input modal
        let modal = document.getElementById('mission-input-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mission-input-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 20px;
                max-width: 500px;
                width: 90%;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            `;
            
            modalContent.innerHTML = `
                <h2 class="mission-input-title" style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 24px; text-align: center;"></h2>
                <form id="mission-input-form">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Mission Title:</label>
                        <input type="text" id="mission-title" required style="
                            width: 100%;
                            padding: 12px;
                            border: 2px solid rgba(0, 122, 255, 0.2);
                            border-radius: 10px;
                            font-size: 16px;
                            transition: border-color 0.2s ease;
                        " placeholder="Enter mission title...">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Description:</label>
                        <textarea id="mission-description" required style="
                            width: 100%;
                            padding: 12px;
                            border: 2px solid rgba(0, 122, 255, 0.2);
                            border-radius: 10px;
                            font-size: 16px;
                            min-height: 100px;
                            resize: vertical;
                            transition: border-color 0.2s ease;
                        " placeholder="Describe your mission..."></textarea>
                    </div>
                    <div class="mission-input-field" style="margin-bottom: 20px;">
                        <!-- Dynamic input field will be inserted here -->
                    </div>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button type="button" id="cancel-mission-input" style="
                            background: rgba(255, 59, 48, 0.1);
                            color: #ff3b30;
                            border: 2px solid rgba(255, 59, 48, 0.3);
                            padding: 12px 24px;
                            border-radius: 12px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        ">Cancel</button>
                        <button type="submit" style="
                            background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 12px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        ">Submit Mission</button>
                    </div>
                </form>
                <button id="close-mission-input-modal" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                ">×</button>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('close-mission-input-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            document.getElementById('cancel-mission-input').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
            
            // Form submission
            document.getElementById('mission-input-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitMission();
            });
        }
        
        // Update title and input field based on type
        modal.querySelector('.mission-input-title').textContent = title;
        const inputField = modal.querySelector('.mission-input-field');
        
        switch (type) {
            case 'photo':
                inputField.innerHTML = `
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Photo URL:</label>
                    <input type="url" id="mission-content" required style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid rgba(0, 122, 255, 0.2);
                        border-radius: 10px;
                        font-size: 16px;
                        transition: border-color 0.2s ease;
                    " placeholder="https://example.com/photo.jpg">
                    <small style="color: #666; font-size: 12px; margin-top: 5px; display: block;">
                        Enter the URL of your photo evidence
                    </small>
                `;
                break;
            case 'text':
                inputField.innerHTML = `
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Text Evidence:</label>
                    <textarea id="mission-content" required style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid rgba(0, 122, 255, 0.2);
                        border-radius: 10px;
                        font-size: 16px;
                        min-height: 80px;
                        resize: vertical;
                        transition: border-color 0.2s ease;
                    " placeholder="Provide detailed text evidence..."></textarea>
                `;
                break;
            case 'link':
                inputField.innerHTML = `
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Link/URL:</label>
                    <input type="url" id="mission-content" required style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid rgba(0, 122, 255, 0.2);
                        border-radius: 10px;
                        font-size: 16px;
                        transition: border-color 0.2s ease;
                    " placeholder="https://example.com">
                    <small style="color: #666; font-size: 12px; margin-top: 5px; display: block;">
                        Enter the URL that supports your mission
                    </small>
                `;
                break;
        }
        
        modal.style.display = 'flex';
    }
    
    async submitMission() {
        if (!this.game.auth.user || !window.db) return;
        
        const title = document.getElementById('mission-title').value;
        const description = document.getElementById('mission-description').value;
        const content = document.getElementById('mission-content').value;
        
        if (!title || !description || !content) {
            this.game.auth.showBottomNotification('❌ Please fill in all fields', 'error');
            return;
        }
        
        try {
            // Determine mission type from the current modal
            const modal = document.getElementById('mission-input-modal');
            const titleText = modal.querySelector('.mission-input-title').textContent;
            let type = 'text';
            if (titleText.includes('Photo')) type = 'photo';
            else if (titleText.includes('Link')) type = 'link';
            
            // Submit to playerMissions collection
            const missionData = {
                playerId: this.game.auth.user.uid,
                playerName: this.game.auth.user.displayName || this.game.auth.user.email,
                title: title,
                description: description,
                content: content,
                type: type,
                status: 'pending',
                submittedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };
            
            await window.addDoc(window.collection(window.db, 'playerMissions'), missionData);
            
            // Close modal and show success
            modal.style.display = 'none';
            this.game.auth.showBottomNotification('✅ Mission submitted successfully!', 'success');
            
            // Clear form
            document.getElementById('mission-input-form').reset();
            
        } catch (error) {
            console.error('Error submitting mission:', error);
            this.game.auth.showBottomNotification('❌ Failed to submit mission', 'error');
        }
    }
    
    showHomeFeedbacksTable() {
        this.showHomeTable('feedbacks', 'Feedbacks from Admins', '📝');
    }
    
    showHomeMissionsTable() {
        this.showHomeTable('missions', 'Your Submitted Missions', '📋');
    }
    
    showHomeOverviewTable() {
        this.showHomeTable('all', 'All Activity', '📊');
    }
    
    showHomeTable(type, title, icon) {
        // Create home table modal
        let modal = document.getElementById('home-table-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'home-table-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                padding: 20px;
                border-radius: 20px;
                max-width: 800px;
                width: 95%;
                max-height: 80vh;
                overflow-y: auto;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            `;
            
            modalContent.innerHTML = `
                <div class="home-table-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid rgba(0, 122, 255, 0.2);
                ">
                    <h2 class="home-table-title" style="margin: 0; color: #1d1d1f; font-size: 24px; display: flex; align-items: center; gap: 10px;">
                        <span class="table-icon">📊</span>
                        <span class="table-title-text">Home Activity</span>
                    </h2>
                    <button id="close-home-table-modal" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                        padding: 5px;
                        border-radius: 50%;
                        transition: background 0.2s ease;
                    ">×</button>
                </div>
                <div class="home-table-tabs" style="
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                ">
                    <button class="table-tab-btn active" data-tab="feedbacks" style="
                        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">📝 Feedbacks</button>
                    <button class="table-tab-btn" data-tab="missions" style="
                        background: rgba(0, 122, 255, 0.1);
                        color: #007AFF;
                        border: 2px solid rgba(0, 122, 255, 0.3);
                        padding: 10px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">📋 Missions</button>
                    <button class="table-tab-btn" data-tab="all" style="
                        background: rgba(0, 122, 255, 0.1);
                        color: #007AFF;
                        border: 2px solid rgba(0, 122, 255, 0.3);
                        padding: 10px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">📊 All</button>
                </div>
                <div class="home-table-content" style="
                    min-height: 300px;
                    max-height: 400px;
                    overflow-y: auto;
                ">
                    <!-- Table content will be loaded here -->
                </div>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('close-home-table-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
            
            // Tab switching
            modal.querySelectorAll('.table-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    // Update active tab
                    modal.querySelectorAll('.table-tab-btn').forEach(b => {
                        b.style.background = 'rgba(0, 122, 255, 0.1)';
                        b.style.color = '#007AFF';
                        b.style.border = '2px solid rgba(0, 122, 255, 0.3)';
                    });
                    
                    e.target.style.background = 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)';
                    e.target.style.color = 'white';
                    e.target.style.border = 'none';
                    
                    // Load content
                    const tabType = e.target.getAttribute('data-tab');
                    this.loadHomeTableContent(tabType);
                });
            });
        }
        
        // Update title and load content
        const titleElement = modal.querySelector('.table-title-text');
        const iconElement = modal.querySelector('.table-icon');
        titleElement.textContent = title;
        iconElement.textContent = icon;
        
        // Set active tab
        modal.querySelectorAll('.table-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === type) {
                btn.classList.add('active');
                btn.style.background = 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)';
                btn.style.color = 'white';
                btn.style.border = 'none';
            } else {
                btn.style.background = 'rgba(0, 122, 255, 0.1)';
                btn.style.color = '#007AFF';
                btn.style.border = '2px solid rgba(0, 122, 255, 0.3)';
            }
        });
        
        // Load initial content
        this.loadHomeTableContent(type);
        
        modal.style.display = 'flex';
    }
    
    async loadHomeTableContent(type) {
        const contentDiv = document.querySelector('.home-table-content');
        if (!contentDiv) return;
        
        contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Loading...</div>';
        
        try {
            let content = '';
            
            if (type === 'feedbacks' || type === 'all') {
                const feedbacks = await this.loadPlayerFeedbacks();
                content += this.renderFeedbacksTable(feedbacks);
            }
            
            if (type === 'missions' || type === 'all') {
                const missions = await this.loadPlayerMissions();
                content += this.renderMissionsTable(missions);
            }
            
            if (type === 'all') {
                content = `<div style="display: flex; flex-direction: column; gap: 30px;">${content}</div>`;
            }
            
            contentDiv.innerHTML = content || '<div style="text-align: center; padding: 40px; color: #666;">No data available</div>';
            
            // Add event listeners for read buttons
            contentDiv.querySelectorAll('.mark-feedback-read-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const feedbackId = e.target.getAttribute('data-feedback-id');
                    this.markFeedbackAsRead(feedbackId);
                });
                
                // Add hover effects
                btn.addEventListener('mouseenter', () => {
                    btn.style.transform = 'scale(1.05)';
                    btn.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                });
                
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = 'scale(1)';
                    btn.style.boxShadow = 'none';
                });
            });
            
        } catch (error) {
            console.error('Error loading home table content:', error);
            contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #ff3b30;">Error loading data</div>';
        }
    }
    
    async loadPlayerFeedbacks() {
        if (!this.game.auth.user || !window.db) return [];
        
        try {
            // Get feedbacks from admin dashboard collection
            const feedbacksRef = window.collection(window.db, 'adminFeedback');
            const q = window.query(feedbacksRef, 
                window.where('playerId', '==', this.game.auth.user.uid)
            );
            const querySnapshot = await window.getDocs(q);
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading player feedbacks:', error);
            return [];
        }
    }
    
    async loadPlayerMissions() {
        if (!this.game.auth.user || !window.db) return [];
        
        try {
            // Get missions from playerMissions collection
            const missionsRef = window.collection(window.db, 'playerMissions');
            const q = window.query(missionsRef, 
                window.where('playerId', '==', this.game.auth.user.uid)
            );
            const querySnapshot = await window.getDocs(q);
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading player missions:', error);
            return [];
        }
    }
    
    renderFeedbacksTable(feedbacks) {
        if (feedbacks.length === 0) {
            return `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📝</div>
                    <div>No feedbacks received yet</div>
                </div>
            `;
        }
        
        return `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #1d1d1f; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                    📝 Feedbacks from Admins (${feedbacks.length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${feedbacks.map(feedback => `
                        <div style="
                            background: rgba(255, 255, 255, 0.7);
                            border: 1px solid rgba(0, 0, 0, 0.1);
                            border-radius: 12px;
                            padding: 15px;
                            transition: all 0.2s ease;
                        " onmouseover="this.style.background='rgba(0, 122, 255, 0.05)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.7)'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 20px;">${feedback.type === 'positive' ? '✅' : '❌'}</span>
                                    <strong style="color: ${feedback.type === 'positive' ? '#28a745' : '#dc3545'};">
                                        ${feedback.type.toUpperCase()}
                                    </strong>
                                </div>
                                <div style="font-size: 12px; color: #666;">
                                    ${new Date(feedback.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong style="color: #333; font-size: 16px;">${feedback.title}</strong>
                            </div>
                            <div style="color: #555; font-size: 14px; line-height: 1.4; margin-bottom: 10px;">
                                ${feedback.message}
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 12px; color: #666;">
                                    From: <strong>${feedback.sentByName || 'Admin'}</strong>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: ${feedback.status === 'read' ? '#28a745' : '#ffc107'};">
                                        ${feedback.status === 'read' ? '✅ Read' : '🔔 Unread'}
                                    </div>
                                    ${feedback.status === 'unread' ? `
                                        <button class="mark-feedback-read-btn" data-feedback-id="${feedback.id}" style="
                                            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                                            color: white;
                                            border: none;
                                            padding: 6px 12px;
                                            border-radius: 15px;
                                            font-size: 11px;
                                            font-weight: 600;
                                            cursor: pointer;
                                            transition: all 0.2s ease;
                                        ">Read</button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderMissionsTable(missions) {
        if (missions.length === 0) {
            return `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                    <div>No missions submitted yet</div>
                </div>
            `;
        }
        
        return `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #1d1d1f; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                    📋 Your Submitted Missions (${missions.length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${missions.map(mission => `
                        <div style="
                            background: rgba(255, 255, 255, 0.7);
                            border: 1px solid rgba(0, 0, 0, 0.1);
                            border-radius: 12px;
                            padding: 15px;
                            transition: all 0.2s ease;
                        " onmouseover="this.style.background='rgba(0, 122, 255, 0.05)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.7)'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 20px;">${mission.type === 'photo' ? '📸' : mission.type === 'link' ? '🔗' : '📝'}</span>
                                    <strong style="color: #333; font-size: 16px;">${mission.title}</strong>
                                </div>
                                <div style="
                                    padding: 4px 12px;
                                    border-radius: 20px;
                                    font-size: 12px;
                                    font-weight: 600;
                                    color: white;
                                    background: ${mission.status === 'approved' ? '#28a745' : mission.status === 'rejected' ? '#dc3545' : '#ffc107'};
                                ">
                                    ${mission.status === 'approved' ? '✅ Approved' : mission.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                                </div>
                            </div>
                            <div style="color: #555; font-size: 14px; line-height: 1.4; margin-bottom: 10px;">
                                ${mission.description}
                            </div>
                            <div style="margin-bottom: 10px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                                    <strong>Evidence (${mission.type}):</strong>
                                </div>
                                <div style="
                                    background: rgba(0, 0, 0, 0.05);
                                    padding: 8px;
                                    border-radius: 6px;
                                    font-size: 12px;
                                    color: #333;
                                    word-break: break-all;
                                ">
                                    ${mission.content}
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666;">
                                <div>Type: <strong>${mission.type.toUpperCase()}</strong></div>
                                <div>Submitted: ${new Date(mission.submittedAt).toLocaleDateString()}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    setupNotificationSystem() {
        // Create notification container
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'feedback-notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 3000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(this.notificationContainer);
        
        // Check for new feedback every 5 seconds
        setInterval(() => {
            this.checkForNewFeedback();
        }, 10000);
        
        // Initial check
        this.checkForNewFeedback();
    }
    
    async checkForNewFeedback() {
        if (!this.game.auth.user || !window.db) return;
        
        try {
            // Check adminFeedback collection for unread feedbacks
            const feedbacksRef = window.collection(window.db, 'adminFeedback');
            const q = window.query(feedbacksRef, 
                window.where('playerId', '==', this.game.auth.user.uid),
                window.where('status', '==', 'unread')
            );
            const querySnapshot = await window.getDocs(q);
            const unreadCount = querySnapshot.docs.length;
            
            // Show notification if there are new unread feedbacks
            if (unreadCount > this.lastFeedbackCount && this.lastFeedbackCount > 0) {
                const newCount = unreadCount - this.lastFeedbackCount;
                this.showFeedbackNotification(newCount);
            }
            
            this.lastFeedbackCount = unreadCount;
        } catch (error) {
            console.error('Error checking for new feedback:', error);
        }
    }
    
    async markFeedbackAsRead(feedbackId) {
        if (!this.game.auth.user || !window.db) return;
        
        try {
            // Update feedback status in adminFeedback collection
            const feedbackRef = window.doc(window.db, 'adminFeedback', feedbackId);
            await window.updateDoc(feedbackRef, {
                status: 'read',
                readAt: new Date().toISOString()
            });
            
            // Show success notification
            this.game.auth.showBottomNotification('✅ Feedback marked as read', 'success');
            
            // Refresh the table content
            const modal = document.getElementById('home-table-modal');
            if (modal && modal.style.display !== 'none') {
                const activeTab = modal.querySelector('.table-tab-btn.active');
                if (activeTab) {
                    const tabType = activeTab.getAttribute('data-tab');
                    this.loadHomeTableContent(tabType);
                }
            }
            
        } catch (error) {
            console.error('Error marking feedback as read:', error);
            this.game.auth.showBottomNotification('❌ Failed to mark feedback as read', 'error');
        }
    }
    
    showFeedbackNotification(count) {
        const notification = document.createElement('div');
        notification.className = 'feedback-notification';
        notification.style.cssText = `
            background: linear-gradient(135deg, #ff3b30 0%, #d70015 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(255, 59, 48, 0.3);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transform: translateX(100%);
            transition: all 0.3s ease;
            pointer-events: auto;
            cursor: pointer;
            max-width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                ">📝</div>
                <div>
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 2px;">
                        New Feedback!
                    </div>
                    <div style="font-size: 14px; opacity: 0.9;">
                        You have ${count} new feedback${count > 1 ? 's' : ''} from admin${count > 1 ? 's' : ''}
                    </div>
                </div>
                <button class="notification-close" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 50%;
                    transition: background 0.2s ease;
                    margin-left: auto;
                ">×</button>
            </div>
        `;
        
        // Add event listeners
        notification.addEventListener('click', () => {
            this.hideNotification(notification);
            // Open home table with feedbacks
            this.showHomeFeedbacksTable();
        });
        
        notification.querySelector('.notification-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideNotification(notification);
        });
        
        // Add hover effects
        notification.addEventListener('mouseenter', () => {
            notification.style.transform = 'translateX(0) scale(1.02)';
            notification.style.boxShadow = '0 12px 30px rgba(255, 59, 48, 0.4)';
        });
        
        notification.addEventListener('mouseleave', () => {
            notification.style.transform = 'translateX(0) scale(1)';
            notification.style.boxShadow = '0 8px 25px rgba(255, 59, 48, 0.3)';
        });
        
        this.notificationContainer.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            this.hideNotification(notification);
        }, 8000);
    }
    
    hideNotification(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new AdventureGame();
    
    // Make debug method available globally
    window.debugFirestoreUsers = () => {
        if (window.game && window.game.auth) {
            return window.game.auth.debugFirestoreUsers();
        } else {
            console.log("❌ Game not initialized yet");
        }
    };
    
        // Make updateStats method available globally for manual stat updates
        window.updatePlayerStats = (updates) => {
            if (window.game && window.game.auth) {
                return window.game.auth.updateStats(updates);
            } else {
                console.log("❌ Game not initialized yet");
            }
        };
        
        // Make polygon collision test available globally
        window.testPolygonCollision = (x, y, width = 24, height = 31.2) => {
            if (window.game && window.game.map) {
                console.log(`🧪 Testing polygon collision at (${x}, ${y}) size (${width}, ${height})`);
                const result = window.game.map.checkCollision(x, y, width, height);
                console.log(`Result: ${result ? 'COLLISION' : 'NO COLLISION'}`);
                return result;
            } else {
                console.log("❌ Game not initialized yet");
            }
        };
});