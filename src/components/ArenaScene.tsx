"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MoveRecord } from "@/domain/chess";
import type { ChessColor, GameStatus } from "@/domain/types";

interface ArenaSceneProps {
  status: GameStatus;
  turn: ChessColor;
  lastMove: MoveRecord | null;
  aiThinking: boolean;
  reducedMotion?: boolean;
}

export function ArenaScene({ status, turn, lastMove, aiThinking, reducedMotion = false }: ArenaSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ status, turn, lastMove, aiThinking, reducedMotion });

  stateRef.current = { status, turn, lastMove, aiThinking, reducedMotion };

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    if (typeof WebGLRenderingContext === "undefined") {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 2.4, 8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.dataset.testid = "arena-scene-canvas";
    renderer.domElement.className = "h-full w-full";
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const keyLight = new THREE.PointLight(0x27c7a3, 2.3, 16);
    keyLight.position.set(-3.4, 3.2, 4.2);
    scene.add(keyLight);

    const goldLight = new THREE.PointLight(0xd6b35a, 1.1, 14);
    goldLight.position.set(3.8, -1.2, 5);
    scene.add(goldLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.28);
    scene.add(ambient);

    const tealMaterial = new THREE.MeshStandardMaterial({
      color: 0x27c7a3,
      roughness: 0.42,
      metalness: 0.62,
      transparent: true,
      opacity: 0.7,
    });
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6b35a,
      roughness: 0.35,
      metalness: 0.74,
      transparent: true,
      opacity: 0.58,
    });
    const graphiteMaterial = new THREE.MeshStandardMaterial({
      color: 0x11181c,
      roughness: 0.7,
      metalness: 0.32,
      transparent: true,
      opacity: 0.78,
    });

    const boardPlane = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.08, 5.7), graphiteMaterial);
    boardPlane.position.set(0, -1.55, -0.35);
    boardPlane.rotation.x = -0.68;
    group.add(boardPlane);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.018, 12, 112), tealMaterial);
    ring.position.set(0, -1.42, -0.35);
    ring.rotation.x = -0.68;
    group.add(ring);

    const pieces: THREE.Mesh[] = [];
    const geometries = [
      new THREE.ConeGeometry(0.26, 0.92, 7),
      new THREE.CylinderGeometry(0.22, 0.3, 0.86, 10),
      new THREE.OctahedronGeometry(0.38),
      new THREE.DodecahedronGeometry(0.34),
      new THREE.CapsuleGeometry(0.2, 0.58, 5, 10),
    ];

    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const radius = index % 2 === 0 ? 3.4 : 4.25;
      const piece = new THREE.Mesh(
        geometries[index % geometries.length],
        index % 3 === 0 ? goldMaterial : index % 2 === 0 ? tealMaterial : graphiteMaterial,
      );
      piece.position.set(Math.cos(angle) * radius, -0.3 + (index % 4) * 0.42, Math.sin(angle) * 1.2 - 0.15);
      piece.rotation.set(index * 0.2, angle, index * 0.11);
      piece.userData.baseY = piece.position.y;
      piece.userData.speed = 0.4 + index * 0.035;
      pieces.push(piece);
      group.add(piece);
    }

    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const current = stateRef.current;
      const pulse = current.lastMove ? 1.15 : 0.85;
      const thinking = current.aiThinking ? 1.65 : 1;
      const statusBoost = current.status === "active" ? 1 : 1.35;

      keyLight.intensity = 1.9 + Math.sin(elapsed * 1.8) * 0.18 + pulse * 0.18 + (current.turn === "white" ? 0.18 : 0);
      goldLight.intensity = 0.82 + Math.cos(elapsed * 1.3) * 0.14 + (current.turn === "black" ? 0.22 : 0) + (current.aiThinking ? 0.32 : 0);

      if (!current.reducedMotion) {
        group.rotation.y = Math.sin(elapsed * 0.12) * 0.08;
        ring.rotation.z = elapsed * 0.16 * thinking;
        boardPlane.rotation.z = Math.sin(elapsed * 0.22) * 0.018;
        pieces.forEach((piece, index) => {
          piece.position.y = piece.userData.baseY + Math.sin(elapsed * piece.userData.speed + index) * 0.18 * statusBoost;
          piece.rotation.y += 0.0045 * thinking;
          piece.rotation.x += 0.0018;
        });
        camera.position.x = Math.sin(elapsed * 0.1) * 0.24;
        camera.lookAt(0, -0.35, 0);
      }

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      geometries.forEach((geometry) => geometry.dispose());
      tealMaterial.dispose();
      goldMaterial.dispose();
      graphiteMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[18px]" />;
}
