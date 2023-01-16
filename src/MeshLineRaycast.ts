import {LineSegments, Matrix4, Ray, Sphere, Vector3} from 'three'
import type {Mesh, Raycaster, Intersection} from 'three'
import type {MeshLineMaterial} from './MeshLineMaterial'
import type {MeshLine} from './MeshLine'

export function MeshLineRaycast(
	mesh: Mesh<MeshLine, MeshLineMaterial>,
	raycaster: Raycaster,
	intersects: Intersection[],
) {
	const inverseMatrix = new Matrix4()
	const ray = new Ray()
	const sphere = new Sphere()
	const interRay = new Vector3()
	const geometry = mesh.geometry
	// Checking boundingSphere distance to ray
	if (!geometry.boundingSphere) geometry.computeBoundingSphere()
	sphere.copy(geometry.boundingSphere!)
	sphere.applyMatrix4(mesh.matrixWorld)

	if (!raycaster.ray.intersectSphere(sphere, interRay)) {
		return
	}

	inverseMatrix.copy(mesh.matrixWorld).invert()
	ray.copy(raycaster.ray).applyMatrix4(inverseMatrix)

	const vStart = new Vector3()
	const vEnd = new Vector3()
	const interSegment = new Vector3()
	const step = mesh instanceof LineSegments ? 2 : 1
	const index = geometry.index
	const attributes = geometry.attributes

	if (index !== null) {
		const indices = index.array
		const positions = attributes.position!.array
		const widths = attributes.width!.array

		for (let i = 0, l = indices.length - 1; i < l; i += step) {
			const a = indices[i]
			const b = indices[i + 1]
			// @prod-prune
			if (a == null || b == null) throw new Error('missing index')

			vStart.fromArray(positions, a * 3)
			vEnd.fromArray(positions, b * 3)
			const width = widths[Math.floor(i / 3)] !== undefined ? widths[Math.floor(i / 3)] : 1
			// @prod-prune
			if (width == null) throw new Error('missing width')
			raycaster.params.Line = raycaster.params.Line ?? {threshold: 1}
			const precision = raycaster.params.Line.threshold + (mesh.material.lineWidth * width) / 2
			const precisionSq = precision * precision

			const distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment)

			if (distSq > precisionSq) continue

			interRay.applyMatrix4(mesh.matrixWorld) //Move back to world space for distance calculation

			const distance = raycaster.ray.origin.distanceTo(interRay)

			if (distance < raycaster.near || distance > raycaster.far) continue

			intersects.push({
				distance: distance,
				// What do we want? intersection point on the ray or on the segment??
				// point: raycaster.ray.at( distance ),
				point: interSegment.clone().applyMatrix4(mesh.matrixWorld),
				index: i,
				face: null,
				faceIndex: undefined,
				object: mesh,
			})
			// make event only fire once
			i = l
		}
	}
}
