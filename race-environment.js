(function () {
  'use strict';
  const host = document.getElementById('race-environment');
  if (!host || !window.WebGLRenderingContext) return;

  let renderer, scene, camera, raf = 0, disposed = false;
  const movers = [];
  const clock = { last: 0 };
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeTrackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#082f49'; ctx.fillRect(0, 0, 256, 512);
    const laneW = 256 / 3, tileH = 64;
    const colors = [['#f97316','#ea580c'],['#e11d48','#eab308'],['#0284c7','#0ea5e9']];
    for (let row = 0; row < 8; row++) {
      for (let lane = 0; lane < 3; lane++) {
        ctx.fillStyle = colors[lane][row % 2];
        ctx.fillRect(lane * laneW + 3, row * tileH + 2, laneW - 6, tileH - 4);
      }
    }
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(laneW - 2, 0, 4, 512); ctx.fillRect(laneW * 2 - 2, 0, 4, 512);
    ctx.fillStyle = '#67e8f9'; ctx.fillRect(0,0,3,512); ctx.fillRect(253,0,3,512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapT = THREE.RepeatWrapping; texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 3); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function addArch(z, index) {
    const group = new THREE.Group();
    group.position.z = z;
    const colors = [0x38bdf8, 0xf43f5e, 0xfacc15, 0xa78bfa];
    const color = colors[index % colors.length];
    const metal = new THREE.MeshStandardMaterial({color:0x0f3d68, metalness:.78, roughness:.24, emissive:0x082f49, emissiveIntensity:.4});
    const glow = new THREE.MeshBasicMaterial({color});
    [-5.3,5.3].forEach((x, i) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.48,.62,7.2,12), metal);
      pillar.position.set(x,3.6,0); group.add(pillar);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(.13,6.4,.15), glow);
      strip.position.set(x + (i ? -.52 : .52),3.7,.1); group.add(strip);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.7), new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.1,metalness:.45,roughness:.2}));
      crystal.position.set(x,7.8,0); group.add(crystal);
    });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(5.3,.22,8,36,Math.PI), new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.65,metalness:.65,roughness:.22}));
    arc.rotation.z = Math.PI; arc.position.y = 7.1; group.add(arc);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(4.95,.075,6,36,Math.PI), new THREE.MeshBasicMaterial({color:0xffffff}));
    inner.rotation.z = Math.PI; inner.position.y = 7.1; group.add(inner);
    scene.add(group); movers.push({object:group, speed:1, recycle:180});
  }

  function init() {
    try {
      renderer = new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(window.innerWidth,window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000,0);
      host.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x18052e,32,145);
      camera = new THREE.PerspectiveCamera(58,window.innerWidth/window.innerHeight,.1,220);
      camera.position.set(0,4.8,11.5); camera.lookAt(0,3,-25);
      scene.add(new THREE.HemisphereLight(0xbfeaff,0x10102e,2.0));
      const key = new THREE.DirectionalLight(0xffe8ff,2.2); key.position.set(-8,18,12); scene.add(key);
      const magenta = new THREE.PointLight(0xec4899,18,70); magenta.position.set(-8,8,-18); scene.add(magenta);
      const cyan = new THREE.PointLight(0x06b6d4,16,70); cyan.position.set(8,7,-34); scene.add(cyan);

      const track = new THREE.Mesh(new THREE.PlaneGeometry(12,220),new THREE.MeshStandardMaterial({map:makeTrackTexture(),roughness:.42,metalness:.2,emissive:0x10203a,emissiveIntensity:.32}));
      track.rotation.x=-Math.PI/2; track.position.set(0,-.2,-78); scene.add(track);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,240),new THREE.MeshStandardMaterial({color:0x080d26,roughness:.96,metalness:.1}));
      ground.rotation.x=-Math.PI/2; ground.position.set(0,-.35,-80); scene.add(ground);

      const skylineMat = new THREE.MeshStandardMaterial({color:0x172554,roughness:.9,metalness:.18,emissive:0x1d4ed8,emissiveIntensity:.12});
      for(let side of [-1,1]) {
        for(let i=0;i<12;i++) {
          const h=5+(i*7%19), w=2.5+(i%3);
          const building=new THREE.Mesh(new THREE.BoxGeometry(w,h,4),skylineMat);
          building.position.set(side*(13+(i%4)*4),h/2-0.3,-22-i*10);
          scene.add(building);
          const winMat=new THREE.MeshBasicMaterial({color:i%2?0x38bdf8:0xec4899});
          for(let y=1.2;y<h-1;y+=2.6) {
            const windows=new THREE.Mesh(new THREE.BoxGeometry(.12,.55,.08),winMat);
            windows.position.set(building.position.x-side*(w/2+.05),y,building.position.z+2.03); scene.add(windows);
          }
        }
      }

      for(let i=0;i<9;i++) addArch(8-i*23,i);
      const geo = new THREE.BufferGeometry(), count=160, positions=new Float32Array(count*3);
      for(let i=0;i<count;i++) { positions[i*3]=(Math.random()-.5)*30; positions[i*3+1]=Math.random()*17; positions[i*3+2]=-Math.random()*120; }
      geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0x67e8f9,size:.22,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));
      scene.add(dust); movers.push({object:dust, particles:true});

      window.addEventListener('resize',resize);
      if(reducedMotion) renderStatic(); else raf=requestAnimationFrame(frame);
    } catch(error) {
      console.warn('3D race environment unavailable; using the app gradient background.',error);
      host.style.display='none';
    }
  }

  function resize() {
    if(!renderer||!camera) return;
    camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  }
  function frame(now) {
    if(disposed) return;
    raf=requestAnimationFrame(frame);
    const dt=Math.min(.05,Math.max(0,(now-clock.last)/1000)); clock.last=now;
    movers.forEach((item,i)=>{
      if(item.particles) {
        const arr=item.object.geometry.attributes.position.array;
        for(let p=1;p<arr.length;p+=3){arr[p]+=.65*dt;if(arr[p]>19)arr[p]=-1;}
        item.object.geometry.attributes.position.needsUpdate=true;
      } else {
        item.object.position.z += 7.5*dt;
        item.object.rotation.y = Math.sin(now*.00018+i)*.035;
        if(item.object.position.z>24) item.object.position.z-=item.recycle;
      }
    });
    renderer.render(scene,camera);
  }
  function renderStatic(){ renderer.render(scene,camera); }
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) cancelAnimationFrame(raf); else if(!reducedMotion&&!disposed) raf=requestAnimationFrame(frame); });
  window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);if(renderer)renderer.dispose();},{once:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();