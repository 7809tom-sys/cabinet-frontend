import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addCabinet, resolvedThreeDVanityFaceLayout } from './InteractiveRoom3D';

const vanityLayout = (drawerSide: 'left' | 'right') => JSON.stringify({
  baseType: 'toe-kick',
  sections: [],
  vanity: { drawerSide, drawerCount: 3, drawerBankRatio: 0.4 },
});

describe('vanity face layout', () => {
  it('parses only explicit persisted left/right vanity drawer-bank rules', () => {
    expect(resolvedThreeDVanityFaceLayout(vanityLayout('left'))).toEqual({ drawerSide: 'left', drawerCount: 3, drawerBankRatio: 0.4 });
    expect(resolvedThreeDVanityFaceLayout(JSON.stringify({ sections: [] }))).toBeNull();
  });

  it('renders left drawers with one right door and mirrors the arrangement when the drawer side changes', () => {
    for (const drawerSide of ['left', 'right'] as const) {
      const root = new THREE.Group();
      addCabinet(root, {
        distributorSkuId: 501,
        cabinetId: 501,
        masterCode: `VANITY-${drawerSide.toUpperCase()}`,
        description: '36 inch vanity',
        placementType: 'base',
        width: 36,
        height: 34.5,
        depth: 21,
        numberOfDoors: 1,
        numberOfDrawers: 3,
        layoutSpec: vanityLayout(drawerSide),
      }, null, {}, 144, 120, '#8a9ba8', '#f8f8f6');
      const drawers: THREE.Mesh[] = [];
      const doors: THREE.Mesh[] = [];
      root.traverse((node) => {
        if (node instanceof THREE.Mesh && node.userData.vanityDrawerFront) drawers.push(node);
        if (node instanceof THREE.Mesh && node.userData.vanityDoorFront) doors.push(node);
      });
      expect(drawers).toHaveLength(3);
      expect(doors).toHaveLength(1);
      expect(drawers.every((drawer) => drawer.userData.drawerSide === drawerSide && drawer.userData.flushPhysicalFace)).toBe(true);
      expect(doors[0]!.userData.drawerSide).toBe(drawerSide);
      expect(drawerSide === 'left' ? drawers[0]!.position.x < doors[0]!.position.x : drawers[0]!.position.x > doors[0]!.position.x).toBe(true);
    }
  });
});
