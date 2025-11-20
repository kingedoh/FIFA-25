// ====== Scene Setup ======
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 25, 35);
camera.lookAt(0,0,0);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ====== Field ======
const field = new THREE.Mesh(new THREE.PlaneGeometry(50,80), new THREE.MeshBasicMaterial({color:0x228B22}));
field.rotation.x = -Math.PI/2;
scene.add(field);

// ====== Ball ======
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5,32,32), new THREE.MeshBasicMaterial({color:0xffffff}));
ball.position.set(0,0.5,0);
scene.add(ball);
let ballVelocity = new THREE.Vector3(0,0,0);
const ballFriction = 0.97;

// ====== Teams ======
const teamSize = 11;
const playerTeam = [];
const aiTeam = [];
const staminaMax = 1;
const staminaDecrease = 0.005;

for(let i=0;i<teamSize;i++){
    const color = (i===0)?0xff0000:0xff5555;
    const p = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color}));
    p.position.set(-20 + (i%6)*8,1,-15 + Math.floor(i/6)*15);
    p.stamina = staminaMax;
    scene.add(p);
    playerTeam.push(p);

    const colorAI = (i===0)?0x0000ff:0x5555ff;
    const ai = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color:colorAI}));
    ai.stamina = staminaMax;
    ai.position.set(-20 + (i%6)*8,1,15 + Math.floor(i/6)*15);
    scene.add(ai);
    aiTeam.push(ai);
}

// ====== Controls ======
let joystick = document.getElementById('joystick');
let analog = {x:0, y:0};
let dragging=false;
let startX=0, startY=0;

joystick.addEventListener('touchstart', e=>{
    dragging=true; startX=e.touches[0].clientX; startY=e.touches[0].clientY;
});
joystick.addEventListener('touchmove', e=>{
    if(!dragging) return;
    let dx=e.touches[0].clientX-startX;
    let dy=e.touches[0].clientY-startY;
    const max=40;
    if(dx>max) dx=max; if(dx<-max) dx=-max;
    if(dy>max) dy=max; if(dy<-max) dy=-max;
    joystick.style.transform=`translate(${dx}px,${dy}px)`;
    analog.x=dx/40; analog.y=-dy/40;
});
joystick.addEventListener('touchend', e=>{
    dragging=false; joystick.style.transform='translate(0,0)'; analog.x=0; analog.y=0;
});

const controls={a:false,b:false,x:false,y:false};
['a','b','x','y'].forEach(id=>{
    const btn=document.getElementById(id);
    btn.addEventListener('touchstart',()=>controls[id]=true);
    btn.addEventListener('touchend',()=>controls[id]=false);
});

// ====== Skill System / Dash / Stamina ======
let charging=false, kickPower=0, score={player:0,ai:0};
function nearBall(player,ball){ return player.position.distanceTo(ball)<1.5; }
function resetBall(){ ball.position.set(0,0.5,0); ballVelocity.set(0,0,0); charging=false; kickPower=0; }

function doSkills(player){
    if(!nearBall(player,ball)) return;

    if(controls.b) ball.position.x += 0.5 * Math.sign(analog.x || 1);
    if(controls.x) ball.position.z -= 0.7;
    if(controls.y && charging && kickPower>0.6){
        ballVelocity.y=0.3;
        ballVelocity.z=player.position.z>0?-0.5:0.5;
    }
}

// ====== Particle effects ======
function spawnTrail(pos){
    const geometry = new THREE.SphereGeometry(0.1,8,8);
    const mat = new THREE.MeshBasicMaterial({color:0xffff00});
    const particle = new THREE.Mesh(geometry, mat);
    particle.position.copy(pos);
    scene.add(particle);
    setTimeout(()=>scene.remove(particle),200);
}

// ====== Game Loop ======
function animate(){
    requestAnimationFrame(animate);
    const player = playerTeam[0];

    let moveSpeed = 0.2 * (controls.b ? 1.5 : 1);
    moveSpeed *= player.stamina;
    player.position.x += analog.x*moveSpeed;
    player.position.z += analog.y*moveSpeed;

    if(controls.b) player.stamina -= staminaDecrease;
    else player.stamina += staminaDecrease/2;
    if(player.stamina>1) player.stamina=1; if(player.stamina<0.2) player.stamina=0.2;

    if(controls.a) charging=true;
    else if(charging){
        if(nearBall(player,ball)){
            ballVelocity.x = (ball.position.x - player.position.x)*kickPower;
            ballVelocity.z = (ball.position.z - player.position.z)*kickPower;
            spawnTrail(ball.position);
        }
        charging=false; kickPower=0;
    }
    if(charging) kickPower+=0.02;

    doSkills(player);

    ball.position.add(ballVelocity);
    ballVelocity.multiplyScalar(ballFriction);
    if(ball.position.y>0.5) ballVelocity.y-=0.01;
    if(ball.position.y<0.5) ball.position.y=0.5;

    aiTeam.forEach((ai,i)=>{
        let aiSpeed=(i===0)?0.2:0.15;
        aiSpeed *= ai.stamina;
        const dirX = ball.position.x - ai.position.x;
        const dirZ = ball.position.z - ai.position.z;
        if(i===0) ai.position.x += dirX*aiSpeed*0.05, ai.position.z=20;
        else ai.position.x += dirX*aiSpeed*0.05, ai.position.z += dirZ*aiSpeed*0.05;
        if(ai.position.distanceTo(ball)<1.5){ ballVelocity.x=dirX*0.25; ballVelocity.z=dirZ*0.25; spawnTrail(ball.position); }
        ai.stamina -= staminaDecrease/2;
        if(ai.stamina<0.2) ai.stamina=0.2;
    });

    camera.position.lerp(new THREE.Vector3(player.position.x,25,player.position.z+35),0.05);
    camera.lookAt(player.position.x,0,player.position.z);

    if(ball.position.z>40){ score.player++; document.getElementById('score').innerText=`Player: ${score.player} | AI: ${score.ai}`; resetBall(); }
    if(ball.position.z<-40){ score.ai++; document.getElementById('score').innerText=`Player: ${score.player} | AI: ${score.ai}`; resetBall(); }

    renderer.render(scene,camera);
}
animate();
