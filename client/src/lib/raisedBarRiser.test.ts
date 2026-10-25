import { it, expect } from "vitest";
import * as THREE from "three";
import { addThreeDPeninsulaCountertops } from "@/components/design/InteractiveRoom3D";
import * as D from "./design";
it("raised bar has a same-material riser filling the step between lower top and bar", () => {
  const room:any={width:144,depth:144,peninsulaRuns:[{id:"main",parentWall:"top",startOffset:24,direction:"right",length:72,height:96,cabinetSide:"left",countertopRaisedBar:true,countertopRaisedBarOverhang:15}]};
  const placed=[0,36].map((off,i)=>{const p=D.wallPlacementAt(off,36,24,"main" as any,room,"left");return {uid:"b"+i,cabinetId:1,masterCode:"B36",description:"b",placement:"base",x:p.x,y:p.y,width:36,depth:24,height:34.5,rotation:p.rotation,wallId:"main",wallOffset:off} as any;});
  const sc=new THREE.Group(); addThreeDPeninsulaCountertops(sc,room,placed,"#fff"); sc.updateMatrixWorld(true);
  const r=sc.children.find(o=>o.userData.raisedBarRiser)!; expect(r).toBeTruthy();
  const b=new THREE.Box3().setFromObject(r);

  expect(b.min.y * 12).toBeCloseTo(36, 1);
  expect(b.max.y * 12).toBeCloseTo(40.5, 1);
  expect(b.min.x * 12).toBeCloseTo(24, 1);
  expect((r as THREE.Mesh).material).toBe((sc.children.find(o=>o.userData.raisedBar) as THREE.Mesh).material);
});
