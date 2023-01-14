// @ts-check
import {
	BufferAttribute,
	BufferGeometry,
	LineSegments,
	Matrix4,
	Ray,
	Sphere,
	Vector3,
	ShaderChunk,
	ShaderMaterial,
	UniformsLib,
	Color,
	Vector2,
} from 'three'

const itemSize = 6

export class MeshLine extends BufferGeometry {
	isMeshLine = true
	type = 'MeshLine'

	#positions = []

	#previous = []
	#next = []
	#side = []
	#width = []
	#indices_array = []
	#uvs = []
	#counters = []

	widthCallback = null

	#attributes = null

	#points = []

	// for declaritive architectures
	// to return the same value that sets the points
	// eg. this.points = points
	// console.log(this.points) -> points
	get points() {
		return this.#points
	}
	set points(value) {
		this.setPoints(value, this.widthCallback)
	}

	setPoints(points, wcb) {
		if (!(points instanceof Float32Array) && !(points instanceof Array)) {
			console.error('ERROR: The BufferArray of points is not instancied correctly.')
			return
		}
		// as the points are mutated we store them
		// for later retreival when necessary (declaritive architectures)
		this.#points = points
		this.widthCallback = wcb
		this.#positions = []
		this.#counters = []
		if (points.length && points[0] instanceof Vector3) {
			// could transform Vector3 array into the array used below
			// but this approach will only loop through the array once
			// and is more performant
			for (let j = 0; j < points.length; j++) {
				const p = points[j]
				const c = j / points.length
				this.#positions.push(p.x, p.y, p.z)
				this.#positions.push(p.x, p.y, p.z)
				this.#counters.push(c)
				this.#counters.push(c)
			}
		} else {
			for (let j = 0; j < points.length; j += 3) {
				const c = j / points.length
				this.#positions.push(points[j], points[j + 1], points[j + 2])
				this.#positions.push(points[j], points[j + 1], points[j + 2])
				this.#counters.push(c)
				this.#counters.push(c)
			}
		}
		this.#process()
	}

	#pointsAreEqual(pointIndexA, pointIndexB) {
		const actualIndexA = pointIndexA * itemSize
		const actualIndexB = pointIndexB * itemSize
		return (
			this.#positions[actualIndexA + 0] === this.#positions[actualIndexB + 0] &&
			this.#positions[actualIndexA + 1] === this.#positions[actualIndexB + 1] &&
			this.#positions[actualIndexA + 2] === this.#positions[actualIndexB + 2]
		)
	}

	#clonePoint(pointIndex) {
		const actualIndex = pointIndex * itemSize
		return [this.#positions[actualIndex + 0], this.#positions[actualIndex + 1], this.#positions[actualIndex + 2]]
	}

	#process() {
		const pointCount = this.#positions.length / itemSize

		this.#previous = []
		this.#next = []
		this.#side = []
		this.#width = []
		this.#indices_array = []
		this.#uvs = []

		let width
		let point

		// initial previous points
		if (this.#pointsAreEqual(0, pointCount - 1)) {
			point = this.#clonePoint(pointCount - 2)
		} else {
			point = this.#clonePoint(0)
		}
		this.#previous.push(point[0], point[1], point[2])
		this.#previous.push(point[0], point[1], point[2])

		for (let j = 0; j < pointCount; j++) {
			// sides
			this.#side.push(1)
			this.#side.push(-1)

			// widths
			if (this.widthCallback) width = this.widthCallback(j / (pointCount - 1))
			else width = 1
			this.#width.push(width)
			this.#width.push(width)

			// uvs
			this.#uvs.push(j / (pointCount - 1), 0)
			this.#uvs.push(j / (pointCount - 1), 1)

			if (j < pointCount - 1) {
				// points previous to poisitions
				point = this.#clonePoint(j)
				this.#previous.push(point[0], point[1], point[2])
				this.#previous.push(point[0], point[1], point[2])

				// indices
				const n = j * 2
				this.#indices_array.push(n, n + 1, n + 2)
				this.#indices_array.push(n + 2, n + 1, n + 3)
			}
			if (j > 0) {
				// points after poisitions
				point = this.#clonePoint(j)
				this.#next.push(point[0], point[1], point[2])
				this.#next.push(point[0], point[1], point[2])
			}
		}

		// last next point
		if (this.#pointsAreEqual(pointCount - 1, 0)) {
			point = this.#clonePoint(1)
		} else {
			point = this.#clonePoint(pointCount - 1)
		}
		this.#next.push(point[0], point[1], point[2])
		this.#next.push(point[0], point[1], point[2])

		// redefining the attribute seems to prevent range errors
		// if the user sets a differing number of vertices
		if (!this.#attributes || this.#attributes.position.count * 3 !== this.#positions.length) {
			this.#attributes = {
				position: new BufferAttribute(new Float32Array(this.#positions), 3),
				previous: new BufferAttribute(new Float32Array(this.#previous), 3),
				next: new BufferAttribute(new Float32Array(this.#next), 3),
				side: new BufferAttribute(new Float32Array(this.#side), 1),
				width: new BufferAttribute(new Float32Array(this.#width), 1),
				uv: new BufferAttribute(new Float32Array(this.#uvs), 2),
				index: new BufferAttribute(new Uint16Array(this.#indices_array), 1),
				counters: new BufferAttribute(new Float32Array(this.#counters), 1),
			}
		} else {
			this.#attributes.position.copyArray(this.#positions)
			this.#attributes.position.needsUpdate = true
			this.#attributes.previous.copyArray(this.#previous)
			this.#attributes.previous.needsUpdate = true
			this.#attributes.next.copyArray(this.#next)
			this.#attributes.next.needsUpdate = true
			this.#attributes.side.copyArray(this.#side)
			this.#attributes.side.needsUpdate = true
			this.#attributes.width.copyArray(this.#width)
			this.#attributes.width.needsUpdate = true
			this.#attributes.uv.copyArray(this.#uvs)
			this.#attributes.uv.needsUpdate = true
			this.#attributes.index.copyArray(this.#indices_array)
			this.#attributes.index.needsUpdate = true
		}

		this.setAttribute('position', this.#attributes.position)
		this.setAttribute('previous', this.#attributes.previous)
		this.setAttribute('next', this.#attributes.next)
		this.setAttribute('side', this.#attributes.side)
		this.setAttribute('width', this.#attributes.width)
		this.setAttribute('uv', this.#attributes.uv)
		this.setAttribute('counters', this.#attributes.counters)

		this.setIndex(this.#attributes.index)

		this.computeBoundingSphere()
		this.computeBoundingBox()
	}

	/**
	 * Fast method to advance the line by one position.  The oldest position is removed.
	 */
	advance(position) {
		const positions = this.#attributes.position.array
		const previous = this.#attributes.previous.array
		const next = this.#attributes.next.array
		const l = positions.length

		// PREVIOUS
		memcpy(positions, 0, previous, 0, l)

		// POSITIONS
		memcpy(positions, itemSize, positions, 0, l - itemSize)

		positions[l - 6] = position.x
		positions[l - 5] = position.y
		positions[l - 4] = position.z
		positions[l - 3] = position.x
		positions[l - 2] = position.y
		positions[l - 1] = position.z

		// NEXT
		memcpy(positions, itemSize, next, 0, l - itemSize)

		next[l - 6] = position.x
		next[l - 5] = position.y
		next[l - 4] = position.z
		next[l - 3] = position.x
		next[l - 2] = position.y
		next[l - 1] = position.z

		this.#attributes.position.needsUpdate = true
		this.#attributes.previous.needsUpdate = true
		this.#attributes.next.needsUpdate = true
	}
}

export function MeshLineRaycast(mesh, raycaster, intersects) {
	const inverseMatrix = new Matrix4()
	const ray = new Ray()
	const sphere = new Sphere()
	const interRay = new Vector3()
	const geometry = mesh.geometry
	// Checking boundingSphere distance to ray

	if (!geometry.boundingSphere) geometry.computeBoundingSphere()
	sphere.copy(geometry.boundingSphere)
	sphere.applyMatrix4(mesh.matrixWorld)

	if (raycaster.ray.intersectSphere(sphere, interRay) === false) {
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
		const positions = attributes.position.array
		const widths = attributes.width.array

		for (let i = 0, l = indices.length - 1; i < l; i += step) {
			const a = indices[i]
			const b = indices[i + 1]

			vStart.fromArray(positions, a * 3)
			vEnd.fromArray(positions, b * 3)
			const width = widths[Math.floor(i / 3)] !== undefined ? widths[Math.floor(i / 3)] : 1
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
				faceIndex: null,
				object: mesh,
			})
			// make event only fire once
			i = l
		}
	}
}

function memcpy(src, srcOffset, dst, dstOffset, length) {
	let i

	src = src.subarray || src.slice ? src : src.buffer
	dst = dst.subarray || dst.slice ? dst : dst.buffer

	src = srcOffset
		? src.subarray
			? src.subarray(srcOffset, length && srcOffset + length)
			: src.slice(srcOffset, length && srcOffset + length)
		: src

	if (dst.set) {
		dst.set(src, dstOffset)
	} else {
		for (i = 0; i < src.length; i++) {
			dst[i + dstOffset] = src[i]
		}
	}

	return dst
}

ShaderChunk['meshline_vert'] = /*glsl*/ `
	${ShaderChunk.logdepthbuf_pars_vertex}
	${ShaderChunk.fog_pars_vertex}
	
	attribute vec3 previous;
	attribute vec3 next;
	attribute float side;
	attribute float width;
	attribute float counters;
	
	uniform vec2 resolution;
	uniform float lineWidth;
	uniform vec3 color;
	uniform float opacity;
	uniform float sizeAttenuation;
	
	varying vec2 vUV;
	varying vec4 vColor;
	varying float vCounters;
	
	vec2 fix( vec4 i, float aspect ) {
	
	    vec2 res = i.xy / i.w;
	    res.x *= aspect;
		 vCounters = counters;
	    return res;
        
	}
	
	void main() {
	
	    float aspect = resolution.x / resolution.y;
	
	    vColor = vec4( color, opacity );
	    vUV = uv;
	
	    mat4 m = projectionMatrix * modelViewMatrix;
	    vec4 finalPosition = m * vec4( position, 1.0 );
	    vec4 prevPos = m * vec4( previous, 1.0 );
	    vec4 nextPos = m * vec4( next, 1.0 );
	
	    vec2 currentP = fix( finalPosition, aspect );
	    vec2 prevP = fix( prevPos, aspect );
	    vec2 nextP = fix( nextPos, aspect );
	
	    float w = lineWidth * width;
	
	    vec2 dir;
	    if( nextP == currentP ) dir = normalize( currentP - prevP );
	    else if( prevP == currentP ) dir = normalize( nextP - currentP );
	    else {
	        vec2 dir1 = normalize( currentP - prevP );
	        vec2 dir2 = normalize( nextP - currentP );
	        dir = normalize( dir1 + dir2 );
	
	        vec2 perp = vec2( -dir1.y, dir1.x );
	        vec2 miter = vec2( -dir.y, dir.x );
	        //w = clamp( w / dot( miter, perp ), 0., 4. * lineWidth * width );
	
	    }
	
	    //vec2 normal = ( cross( vec3( dir, 0. ), vec3( 0., 0., 1. ) ) ).xy;
	    vec4 normal = vec4( -dir.y, dir.x, 0., 1. );
	    normal.xy *= .5 * w;
	    normal *= projectionMatrix;
	    if( sizeAttenuation == 0. ) {
	        normal.xy *= finalPosition.w;
	        normal.xy /= ( vec4( resolution, 0., 1. ) * projectionMatrix ).xy;
	    }
	
	    finalPosition.xy += normal.xy * side;
	
	    gl_Position = finalPosition;
	
        ${ShaderChunk.logdepthbuf_vertex}
        ${ShaderChunk.fog_vertex && /*glsl*/ `vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );`}
        ${ShaderChunk.fog_vertex}
	}
`

ShaderChunk['meshline_frag'] = /*glsl*/ `
	${ShaderChunk.fog_pars_fragment}
	${ShaderChunk.logdepthbuf_pars_fragment}
	
	uniform sampler2D map;
	uniform sampler2D alphaMap;
	uniform float useMap;
	uniform float useAlphaMap;
	uniform float useDash;
	uniform float dashArray;
	uniform float dashOffset;
	uniform float dashRatio;
	uniform float visibility;
	uniform float alphaTest;
	uniform vec2 repeat;

	varying vec2 vUV;
	varying vec4 vColor;
	varying float vCounters;
	
	void main() {
        ${ShaderChunk.logdepthbuf_fragment}

	    vec4 c = vColor;
	    if( useMap == 1. ) c *= texture2D( map, vUV * repeat );
	    if( useAlphaMap == 1. ) c.a *= texture2D( alphaMap, vUV * repeat ).a;
	    if( c.a < alphaTest ) discard;
	    if( useDash == 1. ){
	        c.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
	    }
	    gl_FragColor = c;
	    gl_FragColor.a *= step(vCounters, visibility);
	
        ${ShaderChunk.fog_fragment}
	}
`

export class MeshLineMaterial extends ShaderMaterial {
	isMeshLineMaterial = true
	type = 'MeshLineMaterial'

	constructor(parameters) {
		super({
			uniforms: Object.assign({}, UniformsLib.fog, {
				lineWidth: {value: 1},
				map: {value: null},
				useMap: {value: 0},
				alphaMap: {value: null},
				useAlphaMap: {value: 0},
				color: {value: new Color(0xffffff)},
				opacity: {value: 1},
				resolution: {value: new Vector2(1, 1)},
				sizeAttenuation: {value: 1},
				dashArray: {value: 0},
				dashOffset: {value: 0},
				dashRatio: {value: 0.5},
				useDash: {value: 0},
				visibility: {value: 1},
				alphaTest: {value: 0},
				repeat: {value: new Vector2(1, 1)},
			}),

			vertexShader: ShaderChunk.meshline_vert,

			fragmentShader: ShaderChunk.meshline_frag,
		})

		Object.defineProperties(this, {
			lineWidth: {
				enumerable: true,
				get: function () {
					return this.uniforms.lineWidth.value
				},
				set: function (value) {
					this.uniforms.lineWidth.value = value
				},
			},
			map: {
				enumerable: true,
				get: function () {
					return this.uniforms.map.value
				},
				set: function (value) {
					this.uniforms.map.value = value
				},
			},
			useMap: {
				enumerable: true,
				get: function () {
					return this.uniforms.useMap.value
				},
				set: function (value) {
					this.uniforms.useMap.value = value
				},
			},
			alphaMap: {
				enumerable: true,
				get: function () {
					return this.uniforms.alphaMap.value
				},
				set: function (value) {
					this.uniforms.alphaMap.value = value
				},
			},
			useAlphaMap: {
				enumerable: true,
				get: function () {
					return this.uniforms.useAlphaMap.value
				},
				set: function (value) {
					this.uniforms.useAlphaMap.value = value
				},
			},
			color: {
				enumerable: true,
				get: function () {
					return this.uniforms.color.value
				},
				set: function (value) {
					this.uniforms.color.value = value
				},
			},
			opacity: {
				enumerable: true,
				get: function () {
					return this.uniforms.opacity.value
				},
				set: function (value) {
					this.uniforms.opacity.value = value
				},
			},
			resolution: {
				enumerable: true,
				get: function () {
					return this.uniforms.resolution.value
				},
				set: function (value) {
					this.uniforms.resolution.value.copy(value)
				},
			},
			sizeAttenuation: {
				enumerable: true,
				get: function () {
					return this.uniforms.sizeAttenuation.value
				},
				set: function (value) {
					this.uniforms.sizeAttenuation.value = value
				},
			},
			dashArray: {
				enumerable: true,
				get: function () {
					return this.uniforms.dashArray.value
				},
				set: function (value) {
					this.uniforms.dashArray.value = value
					this.useDash = value !== 0 ? 1 : 0
				},
			},
			dashOffset: {
				enumerable: true,
				get: function () {
					return this.uniforms.dashOffset.value
				},
				set: function (value) {
					this.uniforms.dashOffset.value = value
				},
			},
			dashRatio: {
				enumerable: true,
				get: function () {
					return this.uniforms.dashRatio.value
				},
				set: function (value) {
					this.uniforms.dashRatio.value = value
				},
			},
			useDash: {
				enumerable: true,
				get: function () {
					return this.uniforms.useDash.value
				},
				set: function (value) {
					this.uniforms.useDash.value = value
				},
			},
			visibility: {
				enumerable: true,
				get: function () {
					return this.uniforms.visibility.value
				},
				set: function (value) {
					this.uniforms.visibility.value = value
				},
			},
			alphaTest: {
				enumerable: true,
				get: function () {
					return this.uniforms.alphaTest.value
				},
				set: function (value) {
					this.uniforms.alphaTest.value = value
				},
			},
			repeat: {
				enumerable: true,
				get: function () {
					return this.uniforms.repeat.value
				},
				set: function (value) {
					this.uniforms.repeat.value.copy(value)
				},
			},
		})

		this.setValues(parameters)
	}

	copy(source) {
		super.copy(this, source)

		this.lineWidth = source.lineWidth
		this.map = source.map
		this.useMap = source.useMap
		this.alphaMap = source.alphaMap
		this.useAlphaMap = source.useAlphaMap
		this.color.copy(source.color)
		this.opacity = source.opacity
		this.resolution.copy(source.resolution)
		this.sizeAttenuation = source.sizeAttenuation
		this.dashArray.copy(source.dashArray)
		this.dashOffset.copy(source.dashOffset)
		this.dashRatio.copy(source.dashRatio)
		this.useDash = source.useDash
		this.visibility = source.visibility
		this.alphaTest = source.alphaTest
		this.repeat.copy(source.repeat)

		return this
	}
}
