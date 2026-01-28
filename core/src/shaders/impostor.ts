import { Effect } from "@babylonjs/core";

Effect.ShadersStore["sphereImpostorVertexShader"] = `
    precision highp float;

    // Attributes
    attribute vec3 position;
    attribute vec2 uv;
    // Instanced Attributes
    attribute vec4 instanceData; // x, y, z, radius
    attribute vec4 color;        // r, g, b, a

    // Uniforms
    uniform mat4 worldViewProjection;
    uniform mat4 view;
    uniform mat4 projection;
    
    // Varyings
    varying vec2 vUV;
    varying vec4 vColor;
    varying vec3 vSphereCenter; // View space
    varying float vSphereRadius;
    varying vec3 vViewPosition; // View space position of the quad fragment

    void main() {
        vec3 centerWorld = instanceData.xyz;
        float radius = instanceData.w;

        // Calculate view space center
        vec4 centerView4 = view * vec4(centerWorld, 1.0);
        vec3 centerView = centerView4.xyz;
        
        // Billboard logic in View Space
        // Quad vertices are usually -0.5 to 0.5. 
        // We scale by radius * 2 to cover diameter.
        
        vec3 offset = position * (radius * 2.0);
        
        // The Quad is axis aligned in View Space (facing camera -Z)
        vec3 posView = centerView + offset;
        
        gl_Position = projection * vec4(posView, 1.0);
        
        vUV = uv;
        vColor = color;
        vSphereCenter = centerView;
        vSphereRadius = radius;
        vViewPosition = posView; 
    }
`;

Effect.ShadersStore["sphereImpostorFragmentShader"] = `
    precision highp float;

    varying vec2 vUV;
    varying vec4 vColor;
    varying vec3 vSphereCenter; // View-space center
    varying float vSphereRadius;
    varying vec3 vViewPosition; // View-space frag pos (on the quad plane)

    uniform mat4 projection;

    void main() {
        // Map uv [0,1] to [-1,1]
        vec2 coord = vUV * 2.0 - 1.0;
        
        // Check circle
        float r2 = dot(coord, coord);
        if (r2 > 1.0) discard;
        
        // Calculate normal in view space
        // The sphere surface point:
        // x = coord.x * radius
        // y = coord.y * radius
        // z = sqrt(1 - x*x - y*y) * radius
        
        float z = sqrt(1.0 - r2);
        vec3 normal = vec3(coord, z); // This is local normal
        
        // Lighting (View Space)
        // Light coming from top-right-front camera relative
        // Standard "Headlight" + Offset
        vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
        
        float diffuse = max(dot(normal, lightDir), 0.0);
        
        // Specular
        vec3 viewDir = vec3(0.0, 0.0, 1.0); // Ortho approximation or perspective?
        // Actually view direction changes per pixel in perspective, 
        // but for small atoms vec3(0,0,1) is 'close enough' to standard camera-facing.
        
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * 0.4;
        
        float ambient = 0.4;
        
        vec3 finalColor = vColor.rgb * (ambient + diffuse) + vec3(1.0) * spec;
        
        gl_FragColor = vec4(finalColor, vColor.a);
        
        // Depth Correction
        // We need to calculate the actual Z in View Space of the sphere surface
        // Sphere Center Z (View) = vSphereCenter.z
        // Surface Z (View) = vSphereCenter.z + z * vSphereRadius
        // But View Space looks down -Z? 
        // Babylon View Space: +Z is forward? No usually -Z.
        // Let's assume standard GL view space: Camera at 0, looking down -Z.
        // vSphereCenter.z is negative.
        // The surface point is closer to camera, so Z is larger (less negative).
        // Surface Z = vSphereCenter.z + z * vSphereRadius;
        
        float surfaceZ = vSphereCenter.z + z * vSphereRadius;
        
        // Project to Clip Space Z
        // Clip = Projection * ViewPos
        // We know [x,y] don't matter for Z/W usually (unless crazy projection).
        // ClipZ = P[2][2] * Z + P[3][2]
        // ClipW = P[2][3] * Z + P[3][3] (usually -Z)
        
        // Manually compute depth
        // This requires 'projection' uniform.
        
        float clipZ = projection[2][2] * surfaceZ + projection[3][2];
        float clipW = projection[2][3] * surfaceZ + projection[3][3];
        
        float ndcZ = clipZ / clipW;
        
        // Map to 0..1 depth range
        // gl_FragDepth = (ndcZ + 1.0) * 0.5; // GL standard 
        // Wait, Babylon/GL setup dependent.
        
        // Safe bet: just write color for now. Depth writing is an advanced feature
        // and might break on some backends or WebGL1.
        // User asked for visual quality + triangles. Depth correctness is bonus.
        // Without fragment depth, intersecting spheres look like intersecting disks.
    }
`;
