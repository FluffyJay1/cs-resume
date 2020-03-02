/*
Michael Yang
4/18/19

This is the JS script that makes the bullet hell work. It is used by index.html
*/

(function() {
  "use strict";

  class Point {
    /**
    * Construct a point
    * @param {x} x the x coordinate
    * @param {y} y the y coordinate
    */
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    /**
    * Make a copy of a point
    * @returns {Point} the copy of the point
    */
    copy() {
      return new Point(this.x, this.y);
    }

    /**
    * Add a point to this point
    * @param {Point} point the point to add with
    * @returns {Point} this point
    */
    add(point) {
      this.x += point.x;
      this.y += point.y;
      return this;
    }

    /**
    * Subtract a point from this point
    * @param {Point} point the point to subtract
    * @returns {Point} this point
    */
    subtract(point) {
      this.x -= point.x;
      this.y -= point.y;
      return this;
    }

    /**
    * Multiply this point with a scalar
    * @param {number} mult the number to multiply by
    * @returns {Point} this point
    */
    scale(mult) {
      this.x *= mult;
      this.y *= mult;
      return this;
    }

    /**
    * Get the length of this point from the origin
    * @returns {number} the length
    */
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
    * Set the length of this point to 0
    * @returns {Point} this point
    */
    normalize() {
      //this double equals is intentional
      if(!this.length == 0) {
        this.scale(1/this.length());
      }
      return this;
    }

    /**
    * Convert the relative position style coordinates to a point
    * @param {CSSStyleDeclaration} style the style of the element
    * @returns {Point} the equivalent point
    */
    static styleToPoint(style) {
      //init
      if(style.left === "" || style.top === "") {
        return new Point(0, 0);
      }
      let x = parseInt(style.left.substring(0, style.left.indexOf("px")));
      let y = parseInt(style.top.substring(0, style.top.indexOf("px")));
      return new Point(x, y);
    }

    /**
    * Set an element's positioning style based on a point
    * @param {Point} point the position to use
    * @param {CSSStyleDeclaration} style the style of the element to set
    */
    static pointToStyle(point, style) {
      style.left = point.x + "px";
      style.top = point.y + "px";
    }

    /**
    * Convert an element's screen dimensions to a point
    * @param {DOMElement} element the element to query
    * @return {Point} a representation of the object's dimensions
    */
    static dimensionsToPoint(element) {
      return new Point(element.clientWidth, element.clientHeight);
    }

    /**
    * Get the center of a dom element
    * @param {DOMElement} element the element to query
    * @return {Point} the element's center
    */
    static getCenter(element) {
      return Point.styleToPoint(element.style)
        .add(Point.dimensionsToPoint(element).scale(1/2));
    }

    /**
    * Get the distance between two points
    * @param {Point} p1 first point
    * @param {Point} p2 second point
    * @return {number} the distance between them
    */
    static distance(p1, p2) {
      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    /**
    * Check if two circular elements are colliding
    * @param {DOMElement} e1 the first element
    * @param {DOMElement} e2 the second element
    * @returns {boolean} whether or not the two circular elements are overlapping
    */
    static circleCollide(e1, e2) {
      //assumes both elements are square
      let pos1 = Point.getCenter(e1);
      let pos2 = Point.getCenter(e2);
      return Point.distance(pos1, pos2) <= (e1.firstChild.clientWidth
        + e2.firstChild.clientWidth)/2;
    }

    /**
    * Check if the center of an element is within a circular one
    * @param {DOMElement} point the element that we want the center of
    * @param {DOMElement} circle the circular element
    * @returns {boolean} whether the first element is inside the second one
    */
    static centerInCircle(point, circle) {
      let pos1 = Point.getCenter(point);
      let pos2 = Point.getCenter(circle);
      return Point.distance(pos1, pos2) <= circle.firstChild.clientWidth/2;
    }
  }

  class Bullet {
    /**
    * Create a bullet
    * @param {DOMElement} element the associated element to represent it on the screen
    * @param {Point} pos the position of the bullet
    * @param {Point} vel the velocity of the bullet
    * @param {Point} accel the acceleration of the bullet
    */
    constructor(element, pos, vel, accel) {
      this.element = element;
      Point.pointToStyle(pos, element.style);
      this.pos = pos;
      this.vel = vel;
      this.accel = accel;
    }

    /**
    * Update movement of bullet
    * @param {number} dt the amount of time passed since this was last called
    */
    updateKinematics(dt) {
      let dr = this.vel.copy().scale(dt);
      let dv = this.accel.copy().scale(dt);
      this.pos.add(dr);
      this.vel.add(dv);
      Point.pointToStyle(this.pos, this.element.style);
    }
  }

  const ROUND_STATE = {play:0, break:1};
  const PLAYER_SPEED = {normal:300, focus:150};
  const PLAYER_START = new Point(200, 400);
  const PLAYER_INVULN_TIME = 3;
  const PLAYER_SHOOT_INTERVAL = 0.2;
  const PLAYER_SHOOT_COUNT = 5;
  const PLAYER_SHOOT_SPEED = 400;
  const ENEMY_HEALTH = {base:10, perLevel:50};
  const ENEMY_START = new Point(200, 25);
  const ENEMY_MIN_Y = 50;
  const ENEMY_MAX_Y = 200;
  let keysPressed = {w:false, a:false, s:false, d:false, space:false};
  let playerStats = {lives:5, score:0, invulnTimer:0, shootTimer:0};
  let enemyStats = {level:1, health:0};
  let styleBonuses = {
    enemyBulletShrink:{active:false, description:".enemy-bullet {width: 75%; height: 75%;}"},
    enemyGrow:{active:false, description:"#enemy {width: 150%; height: 150%;}"},
    playerBulletGrow:{active:false, description:".player-bullet {width: 200%; height: 200%;}"},
    playAreaGrow:{active:false, description:"#play-area {width: 150%;}"},
    playerBulletTransparent:{active:false, description:".player-bullet {opacity: 0.5;}"}
  };
  let currentStyleChoices = [{}, {}];
  let prevTimestamp = 0;
  let playArea = {}, player = {}, enemy = {};
  let playerBullets = [];
  let enemyBullets = [];
  let roundState = ROUND_STATE.break;
  let enemyAttackState = {attack:0, timer:0, thinkTimer:0, thinkInterval:1, thinkInstance:0};
  let enemyMoveState = {destination:new Point(0, 0), speed:100, timer:0};

  window.addEventListener("load", init);
  window.addEventListener("keydown", keyPress);
  window.addEventListener("keyup", keyUp);

  /**
  * Initialization function, run when document loads.
  */
  function init() {
    let startButton = document.querySelector("#start button");
    startButton.addEventListener("click", gameStart);
    let continueButton = document.querySelector("#bonus-select button");
    continueButton.addEventListener("click", selectBonus);

    playArea = document.getElementById("play-area");
    player = addPlayAreaElement("img/player.png");
    player.id = "player";
    enemy = addPlayAreaElement("img/enemy.png");
    enemy.id = "enemy";
    prevTimestamp = performance.now();
    update(prevTimestamp);
  }

  /**
  * Function to update everything in the play field, called very often. In fact,
  * it calls itself by passing itself as a callback for the window to call later.
  * @param {number} timestamp the system time in millis
  */
  function update(timestamp) {
    //update time
    let dt = (timestamp - prevTimestamp) / 1000;
    prevTimestamp = timestamp;

    if(roundState === ROUND_STATE.play) {
      updatePlayer(dt);
      updateEnemy(dt);
      updateBullets(dt);
    }

    window.requestAnimationFrame(update);
  }

  /**
  * Handle start of game from the button press.
  */
  function gameStart() {
    document.getElementById("music").play();
    roundStart();
  }

  /**
  * Handle the start of a round.
  */
  function roundStart() {
    roundState = ROUND_STATE.play;
    document.getElementById("interact").classList.add("hidden");
    initPlayer();
    initEnemy();
    clearBullets();
  }

  /**
  * Handles the end of a round.
  */
  function roundEnd() {
    roundState = ROUND_STATE.break;
    playerStats.lives++;
    enemyStats.level++;
    document.getElementById("interact").classList.remove("hidden");
    document.getElementById("start").classList.add("hidden");
    document.getElementById("bonus-select").classList.remove("hidden");
    decideStyleBonusChoices();
  }

  /**
  * Helper method to determine which upgrades have not been selected.
  * @returns {list} list of unselected style upgrades
  */
  function getUnselectedStyles() {
    let unselected = [];
    let entries = Object.entries(styleBonuses);
    for(let i = 0; i < entries.length; i++) {
      if(!entries[i][1].active) { //i is current entry, 1 gives bonus object, 0 gives active
        unselected.push(entries[i][1]);
      }
    }
    return unselected;
  }

  /**
  * Confirms selected upgrade and applies it
  */
  function selectBonus() {
    let choice = document.querySelector("#bonus-select input[name='bonus']:checked").value;
    currentStyleChoices[choice - 1].active = true;
    let displayList = document.querySelector("#applied-styles ul");
    let li = document.createElement("LI");
    li.innerText = currentStyleChoices[choice - 1].description;
    displayList.appendChild(li);
    if(styleBonuses.playAreaGrow.active) {
      playArea.classList.add("width-upgrade");
    }
    if(styleBonuses.enemyGrow.active) {
      enemy.classList.add("enemy-downgrade");
    }
    roundStart();
  }

  /**
  * Decides which two style bonuses to display to the player
  */
  function decideStyleBonusChoices() {
    let unselected = getUnselectedStyles();
    if(unselected.length >= 2) {
      let labels = document.querySelectorAll("#bonus-select label");
      for(let i = 0; i < 2; i++) {
        currentStyleChoices[i] = removeRandom(unselected);
        labels[i].textContent = currentStyleChoices[i].description;
      }
    } else {
      roundStart();
    }
  }

  //player stuff
  /**
  * Initializes player
  */
  function initPlayer() {
    Point.pointToStyle(PLAYER_START, player.style);
    updatePlayerStats();
  }

  /**
  * Update function for player to be called frequently
  * @param {number} dt the amount of time passed since this was last called
  */
  function updatePlayer(dt) {
    playerMove(dt);
    if(playerStats.invulnTimer > 0) {
      playerStats.invulnTimer -= dt;
      //remove transparency when no longer invulnerable
      if(playerStats.invulnTimer <= 0) {
        player.firstChild.classList.remove("invuln");
      }
    }
    playerStats.shootTimer -= dt;
    if(playerStats.shootTimer <= 0) {
      playerShoot();
      playerStats.shootTimer += PLAYER_SHOOT_INTERVAL;
    }
  }

  /**
  * Handle player input and movement
  * @param {number} dt the amount of time passed since this was last called
  */
  function playerMove(dt) {
    //player input
    let playerPos = Point.styleToPoint(player.style);
    let dir = new Point(0, 0);
    if(keysPressed.a) {
      dir.x -= 1;
    }
    if(keysPressed.d) {
      dir.x += 1;
    }
    if(keysPressed.w) {
      dir.y -= 1;
    }
    if(keysPressed.s) {
      dir.y += 1;
    }
    dir.normalize();
    let speed = PLAYER_SPEED.normal;
    if(keysPressed.space) {
      speed = PLAYER_SPEED.focus;
    }
    dir.scale(speed * dt);
    playerPos.add(dir);
    Point.pointToStyle(playerPos, player.style);
    clampToParent(player);
  }

  /**
  * Makes the player shoot a bunch of bullets in a spread
  */
  function playerShoot() {
    let playerPos = Point.styleToPoint(player.style);
    for(let i = -(PLAYER_SHOOT_COUNT - 1)/2; i <= (PLAYER_SHOOT_COUNT - 1)/2; i++) {
      spawnBullet(true, playerPos.copy(),
        (new Point(i * i * i, -10 * i * i - 1)).normalize().scale(PLAYER_SHOOT_SPEED),
        new Point(0, 0));
    }
  }

  /**
  * Handle player death
  */
  function playerDeath() {
    if(playerStats.lives >= 1) {
      Point.pointToStyle(PLAYER_START, player.style);
      playerStats.invulnTimer = PLAYER_INVULN_TIME;
      player.firstChild.classList.add("invuln");
      playerStats.lives--;
      updatePlayerStats();
    } else {
      //TODO: implement proper gameover
      roundState = ROUND_STATE.break;
    }
  }

  /**
  * Update display of player stats in HTML
  */
  function updatePlayerStats() {
    document.querySelector("#lives p").innerText = playerStats.lives;
    document.querySelector("#score p").innerText = playerStats.score;
  }

  //enemy stuff
  /**
  * Initialize the enemy
  */
  function initEnemy() {
    Point.pointToStyle(ENEMY_START, enemy.style);
    enemyStats.health = ENEMY_HEALTH.base + ENEMY_HEALTH.perLevel * enemyStats.level;
    enemyAttackState.thinkTimer = 0;
    enemyAttackState.thinkInstance = 0;
    enemyAttackState.timer = 0;
    newEnemyDestination();
    updateEnemyStats();
  }

  /**
  * Update function for enemy, called frequently
  * @param {number} dt the amount of time passed since this was last called
  */
  function updateEnemy(dt) {
    let enemyPos = Point.styleToPoint(enemy.style);
    enemyMoveState.timer -= dt;
    if(Point.distance(enemyPos, enemyMoveState.destination) <= enemy.firstChild.clientWidth
      || enemyMoveState.timer <= 0) {
      newEnemyDestination();
    }
    enemyPos.add(enemyMoveState.destination.copy().subtract(enemyPos).normalize()
      .scale(dt * enemyMoveState.speed));
    updateEnemyAttack(dt);
    Point.pointToStyle(enemyPos, enemy.style);
  }

  /**
  * Helper method to make the enemy choose a place to move to
  */
  function newEnemyDestination() {
    enemyMoveState.destination = new Point(
      Math.random() * (playArea.clientWidth - enemy.firstChild.clientWidth),
      ENEMY_MIN_Y + Math.random() * (ENEMY_MAX_Y - ENEMY_MIN_Y));
    enemyMoveState.timer = 5;
  }

  /**
  * Help handle enemy attack logic
  * @param {number} dt the amount of time passed since this was last called
  */
  function updateEnemyAttack(dt) {
    enemyAttackState.timer -= dt;
    if(enemyAttackState.timer <= 0) {
      enemyEnterAttackState(Math.floor(Math.random() * 4));
    } else {
      enemyAttackState.thinkTimer -= dt;
      if(enemyAttackState.thinkTimer <= 0) {
        enemyAttackState.thinkTimer += enemyAttackState.thinkInterval;
        enemyAttackThink(enemyAttackState.thinkInstance);
        enemyAttackState.thinkInstance++;
      }
    }
  }

  /**
  * Function to make the enemy attack at discrete intervals
  * @param {number} instance the nth occurence of this method being called in an attack
  */
  function enemyAttackThink(instance) {
    if(enemyAttackState.attack === 0) {
      const vel = 100, accel = 20;
      if(instance % 2 === 0) {
        let randomOffset = Math.random() * 32 - 16;
        let numBullets = 10 + enemyStats.level * 2;
        for(let i = 0; i < numBullets; i++) {
          let yPos = (i / numBullets * playArea.clientHeight) + randomOffset;
          spawnBullet(false, new Point(0, yPos), new Point(vel, 0), new Point(accel, 0));
        }
        randomOffset = Math.random() * 32 - 16;
        for(let i = 0; i < numBullets; i++) {
          let yPos = (i / numBullets * playArea.clientHeight) + randomOffset;
          spawnBullet(false, new Point(playArea.clientWidth - 18, yPos),
            new Point(-vel, 0), new Point(-accel, 0));
        }
      } else {
        let randomOffset = Math.random() * 32 - 16;
        let numBullets = 7 + enemyStats.level;
        for(let i = 0; i < numBullets; i++) {
          let xPos = (i / numBullets * playArea.clientWidth) + randomOffset;
          spawnBullet(false, new Point(xPos, 0), new Point(0, vel), new Point(0, accel));
        }
        randomOffset = Math.random() * 32 - 16;
        for(let i = 0; i < numBullets; i++) {
          let xPos = (i / numBullets * playArea.clientWidth) + randomOffset;
          spawnBullet(false, new Point(xPos, playArea.clientHeight - 18),
            new Point(0, -vel), new Point(0, -accel));
        }
      }
    } else if(enemyAttackState.attack === 1) {
      const vel = 150;
      let enemyPos = Point.styleToPoint(enemy.style);
      let delta = Point.styleToPoint(player.style).subtract(enemyPos).normalize();
      for(let i = -1 - enemyStats.level; i < 1 + enemyStats.level; i++) {
        let v = delta.copy().scale(6 + enemyStats.level).add(new Point(i, 0))
          .normalize().scale(vel);
        spawnBullet(false, enemyPos.copy(), v, new Point(0, 0));
      }
    } else if(enemyAttackState.attack === 2) {
      const vel = 200;
      const accel = 500;
      let enemyPos = Point.styleToPoint(enemy.style);
      for(let i = 0; i < 15 + enemyStats.level * 10; i++) {
        let dir = (new Point(Math.random() - 0.5, Math.random() - 0.5)).normalize();
        spawnBullet(false, enemyPos.copy(), dir.copy().scale(vel), dir.copy().scale(-accel));
      }
    } else if(enemyAttackState.attack === 3) {
      const vel = 200;
      const maxAccel = 600;
      let enemyPos = Point.styleToPoint(enemy.style);
      let delta = Point.styleToPoint(player.style).subtract(enemyPos).normalize();
      for(let i = 0; i < 12 + enemyStats.level * 6; i++) {
        let randomDir = (new Point(Math.random() - 0.5, Math.random() - 0.5)).normalize();
        spawnBullet(false, enemyPos.copy(), delta.copy().scale(vel),
          randomDir.copy().scale(Math.random() * maxAccel));
      }
    }
  }

  /**
  * Makes the enemy enter an attack state
  * @param {number} state the state to enter
  */
  function enemyEnterAttackState(state) {
    enemyAttackState.attack = state;
    enemyAttackState.thinkInstance = 0;
    enemyAttackState.thinkTimer = 0;
    switch(state){
      case 0:
        enemyAttackState.timer = 10;
        enemyAttackState.thinkInterval = 2;
        enemyMoveState.speed = 50;
        break;
      case 1:
        enemyAttackState.timer = 6;
        enemyAttackState.thinkInterval = 0.6;
        enemyMoveState.speed = 300;
        break;
      case 2:
        enemyAttackState.timer = 8;
        enemyAttackState.thinkInterval = 1.5;
        enemyMoveState.speed = 150;
        break;
      case 3:
        enemyAttackState.timer = 6;
        enemyAttackState.thinkInterval = 2;
        enemyMoveState.speed = 200;
        break;
    }
  }

  /**
  * Handle enemy being hit by a bullet
  */
  function enemyHit() {
    enemyStats.health--;
    updateEnemyStats();
    playerStats.score += 100;
    updatePlayerStats();
    if(enemyStats.health <= 0 && roundState === ROUND_STATE.play) {
      roundEnd();
    }
  }

  /**
  * Handle updating enemy stats on the HTML
  */
  function updateEnemyStats() {
    let maxHealth = ENEMY_HEALTH.base + ENEMY_HEALTH.perLevel * enemyStats.level;
    document.getElementById("enemy-health").style.height
      = Math.round(enemyStats.health / maxHealth * 100) + "%";
  }

  //EVERYTHING BULLETS
  /**
  * Update all bullets with respect to time
  * @param {number} dt the amount of time passed since this was last called
  */
  function updateBullets(dt) {
    for(let i = 0; i < playerBullets.length; i++) {
      let entry = playerBullets[i];
      entry.updateKinematics(dt);
      if(!isInParent(entry.element)) {
        destroyBullet(entry);
        i--;
      } else if(Point.circleCollide(enemy, entry.element)) {
        destroyBullet(entry);
        enemyHit();
        i--;
      }
    }
    for(let i = 0; i < enemyBullets.length; i++) {
      let entry = enemyBullets[i];
      entry.updateKinematics(dt);
      if(!isInParent(entry.element)) {
        destroyBullet(entry);
        i--;
      } else if(Point.centerInCircle(player, entry.element) && playerStats.invulnTimer <= 0) {
        //collision with player
        destroyBullet(entry);
        playerDeath();
        i--;
      }
    }
  }

  /**
  * Create a bullet on the play area
  * @param {boolean} player whether or not this was created by a player
  * @param {Point} pos the position of the bullet
  * @param {Point} vel the velocity of the bullet
  * @param {Point} accel the acceleration of the bullet
  * @returns {Bullet} the bullet created
  */
  function spawnBullet(player, pos, vel, accel) {
    let element = {};
    if(player) {
      element = addPlayAreaElement("img/playerbullet.png");
    } else {
      element = addPlayAreaElement("img/enemybullet.png");
    }
    let bullet = new Bullet(element, pos, vel, accel);
    if(player) {
      element.classList.add("player-bullet");
      if(styleBonuses.playerBulletGrow.active) {
        element.classList.add("player-bullet-upgrade");
      }
      if(styleBonuses.playerBulletTransparent.active) {
        element.classList.add("player-bullet-transparent");
      }
      playerBullets.push(bullet);
    } else {
      element.classList.add("enemy-bullet");
      if(styleBonuses.enemyBulletShrink.active) {
        element.classList.add("enemy-bullet-downgrade");
      }
      enemyBullets.push(bullet);
    }
    return bullet; //for debugging purposes
  }

  /**
  * Removes a bullet from the play area
  * @param {Bullet} bullet the bullet to destroy
  */
  function destroyBullet(bullet) {
    //remove from dom
    bullet.element.remove();
    //remove from array
    let ind = enemyBullets.indexOf(bullet);
    if(ind !== -1) {
      enemyBullets.splice(ind, 1);
    } else {
      ind = playerBullets.indexOf(bullet);
      if(ind !== -1) {
        playerBullets.splice(ind, 1);
      }
    }
  }

  /**
  * Destroy all bullets on the play area
  */
  function clearBullets() {
    while(playerBullets.length > 0) {
      let bullet = playerBullets[0];
      bullet.element.remove();
      playerBullets.shift();
    }
    while(enemyBullets.length > 0) {
      let bullet = enemyBullets[0];
      bullet.element.remove();
      enemyBullets.shift();
    }
  }

  //GENERAL HELPER METHODS FOR THINGS IN THE PLAY AREA
  /**
  * Adds an element to the play area
  * @param {string} imgsrc the image to go with the element
  * @returns {DOMElement} the div element created
  */
  function addPlayAreaElement(imgsrc) {
    let stacker = document.createElement("DIV");
    stacker.classList.add("stacker");
    let image = document.createElement("IMG");
    stacker.appendChild(image);
    image.src = imgsrc;
    playArea.appendChild(stacker);
    return stacker;
  }

  /**
  * Keep an element's coordinates constrained within the play area
  * @param {DOMElement} element the element to constrain
  */
  function clampToParent(element) {
    let pos = Point.styleToPoint(element.style);
    if(pos.x < 0) {
      pos.x = 0;
    }
    if(pos.x > element.parentNode.clientWidth - element.firstChild.clientWidth) {
      pos.x = element.parentNode.clientWidth - element.firstChild.clientWidth;
    }
    if(pos.y < 0) {
      pos.y = 0;
    }
    if(pos.y > element.parentNode.clientHeight - element.firstChild.clientHeight) {
      pos.y = element.parentNode.clientHeight - element.firstChild.clientHeight;
    }
    Point.pointToStyle(pos, element.style);
  }

  /**
  * Check whether an element is inside the play area
  * @param {DOMElement} element the element to check for
  * @returns {boolean} the result of the check
  */
  function isInParent(element) {
    let pos = Point.styleToPoint(element.style);
    return pos.x >= 0 && pos.x <= element.parentNode.clientWidth
      - element.firstChild.clientWidth
      && pos.y >= 0 && pos.y <= element.parentNode.clientHeight
      - element.firstChild.clientHeight;
  }

  /**
  * Helper function to handle button pressing
  * @param {string} code the key code
  * @param {boolean} pressed the state of the button
  */
  function keyInput(code, pressed) {
    switch(code) {
      case "KeyW":
        keysPressed.w = pressed;
        break;
      case "KeyA":
        keysPressed.a = pressed;
        break;
      case "KeyS":
        keysPressed.s = pressed;
        break;
      case "KeyD":
        keysPressed.d = pressed;
        break;
      case "Space":
        keysPressed.space = pressed;
        break;
    }
  }

  /**
  * Helper method to handle button pressing
  * @param {KeyboardEvent} e the event passed from the event listener
  */
  function keyPress(e) {
    keyInput(e.code, true);
  }

  /**
  * Helper method to handle button pressing
  * @param {KeyboardEvent} e the event passed from the event listener
  */
  function keyUp(e) {
    keyInput(e.code, false);
  }

  /**
  * Helper method to remove a random element from a list
  * @param {list} list the list to remove from
  * @returns {undefined} the randomly removed element of the list
  */
  function removeRandom(list) {
    let ind = Math.floor(Math.random() * list.length);
    let selected = list[ind];
    list.splice(ind, 1);
    return selected;
  }

})();
