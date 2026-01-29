import { Effect } from "@babylonjs/core";

Effect.ShadersStore["sphereImpostorVertexShader"] = `
    precision highp float;

    // Attributes
    attribute vec3 position;
    attribute vec2 uv;
    // Instanced Attributes
    attribute vec4 instanceData; // x, y, z, radius
    attribute vec4 instanceColor;        // r, g, b, a

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
        vColor = instanceColor;
        vSphereCenter = centerView;
        vSphereRadius = radius;
        vViewPosition = posView; 
    }
`;

Effect.ShadersStore["sphereImpostorFragmentShader"] = `
precision highp float;
#ifdef GL_EXT_frag_depth
#extension GL_EXT_frag_depth : enable
#endif

// Uniforms
uniform mat4 projection;

// Lighting Uniforms (MUST be view-space, normalized)
uniform vec3 lightDir;
uniform float lightAmbient;
uniform float lightDiffuse;
uniform float lightSpecular;
uniform float lightSpecularPower;

// Varyings
varying vec2 vUV;
varying vec4 vColor;
varying vec3 vSphereCenter; // View-space center
varying float vSphereRadius;

void main() {
    // Map uv [0,1] -> [-1,1]
    vec2 coord = vUV * 2.0 - 1.0;

    float r2 = dot(coord, coord);
    if (r2 > 1.0) discard;

    float z = sqrt(1.0 - r2);

    // Surface point on sphere in VIEW space
    // Note: -z (camera looks down -Z in view space)
    vec3 P = vec3(
        vSphereCenter.x + coord.x * vSphereRadius,
        vSphereCenter.y + coord.y * vSphereRadius,
        vSphereCenter.z - z * vSphereRadius
    );

    // View-space normal consistent with P
    vec3 normal = normalize(P - vSphereCenter);

    // Lighting vectors in VIEW space
    vec3 L = normalize(lightDir);
    vec3 V = normalize(-P); // from surface point to camera (origin)
    float diffuse = max(dot(normal, L), 0.0);

    // Blinn-Phong specular (more stable than reflect)
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(normal, H), 0.0), lightSpecularPower) * lightSpecular;

    vec3 finalColor = vColor.rgb * (lightAmbient + diffuse * lightDiffuse) + vec3(1.0) * spec;
    gl_FragColor = vec4(finalColor, vColor.a);

    // Depth Correction
    float surfaceZ = P.z;

    float clipZ = projection[2][2] * surfaceZ + projection[3][2];
    float clipW = projection[2][3] * surfaceZ + projection[3][3];
    float ndcZ = clipZ / clipW;
    float depth = (ndcZ + 1.0) * 0.5;

    #ifdef GL_EXT_frag_depth
    gl_FragDepthEXT = depth;
    #else
    gl_FragDepth = depth;
    #endif
}
`;

Effect.ShadersStore["bondImpostorVertexShader"] = `
    precision highp float;

    // Attributes
    attribute vec3 position;
    attribute vec2 uv;
    // Instanced Attributes
    attribute vec4 instanceData0; // center xyz, radius
    attribute vec4 instanceData1; // dir xyz, length
    attribute vec4 instanceColor0; // r, g, b, a
    attribute vec4 instanceColor1; // r, g, b, a
    attribute vec4 instanceSplit;  // split offset (x)

    // Uniforms
    uniform mat4 view;
    uniform mat4 projection;

    // Varyings
    varying vec2 vUV;
    varying vec4 vColor0;
    varying vec4 vColor1;
    varying float vSplit;
    varying vec3 vCenterView;
    varying vec3 vDirView;
    varying float vRadius;
    varying float vHalfLen;
    varying vec3 vPosView;

    void main() {
        vec3 centerWorld = instanceData0.xyz;
        float radius = instanceData0.w;
        vec3 dirWorld = instanceData1.xyz;
        float bondLen = instanceData1.w;

        vec3 centerView = (view * vec4(centerWorld, 1.0)).xyz;
        vec3 dirView = normalize((view * vec4(dirWorld, 0.0)).xyz);
        vec3 viewDir = normalize(-centerView);

        vec3 right = normalize(cross(dirView, viewDir));
        if (length(right) < 1e-6) {
            right = normalize(cross(dirView, vec3(0.0, 1.0, 0.0)));
        }

        float halfLen = bondLen * 0.5;

        vec3 posView = centerView
            + right * (position.x * radius * 2.0)
            + dirView * (position.y * bondLen);

        gl_Position = projection * vec4(posView, 1.0);

        vUV = uv;
        vColor0 = instanceColor0;
        vColor1 = instanceColor1;
        vSplit = instanceSplit.x;
        vCenterView = centerView;
        vDirView = dirView;
        vRadius = radius;
        vHalfLen = halfLen;
        vPosView = posView;
    }
`;

Effect.ShadersStore["bondImpostorFragmentShader"] = `
precision highp float;
#ifdef GL_EXT_frag_depth
#extension GL_EXT_frag_depth : enable
#endif

varying vec2 vUV;
varying vec4 vColor0;
varying vec4 vColor1;
varying float vSplit;
varying vec3 vCenterView;
varying vec3 vDirView;
varying float vRadius;
varying float vHalfLen;
varying vec3 vPosView;

uniform mat4 projection;

// Lighting Uniforms (MUST be view-space, normalized)
uniform vec3 lightDir;
uniform float lightAmbient;
uniform float lightDiffuse;
uniform float lightSpecular;
uniform float lightSpecularPower;

void main() {
    // Ray from camera (origin) through this fragment position in view space
    vec3 D = normalize(vPosView);
    vec3 CO = -vCenterView;
    vec3 A = normalize(vDirView);

    // Ray-cylinder intersection (infinite cylinder around axis A)
    vec3 dPerp = D - A * dot(D, A);
    vec3 mPerp = CO - A * dot(CO, A);

    float a = dot(dPerp, dPerp);
    if (a < 1e-6) discard;

    float b = 2.0 * dot(dPerp, mPerp);
    float c = dot(mPerp, mPerp) - vRadius * vRadius;

    float disc = b * b - 4.0 * a * c;
    if (disc < 0.0) discard;

    float sqrtDisc = sqrt(disc);
    float t = (-b - sqrtDisc) / (2.0 * a);
    if (t < 0.0) {
        t = (-b + sqrtDisc) / (2.0 * a);
        if (t < 0.0) discard;
    }

    vec3 P = D * t;                 // hit point in VIEW space
    float s = dot(P - vCenterView, A);
    if (s < -vHalfLen || s > vHalfLen) discard;

    vec3 closest = vCenterView + A * s;
    vec3 normal = normalize(P - closest);

    // Lighting vectors in VIEW space
    vec3 L = normalize(lightDir);
    vec3 V = normalize(-P); // from hit point to camera (origin)
    float diffuse = max(dot(normal, L), 0.0);

    // Blinn-Phong specular
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(normal, H), 0.0), lightSpecularPower) * lightSpecular;

    vec4 vColor = (s < vSplit) ? vColor0 : vColor1;
    vec3 finalColor = vColor.rgb * (lightAmbient + diffuse * lightDiffuse) + vec3(1.0) * spec;

    gl_FragColor = vec4(finalColor, vColor.a);

    // Depth
    float clipZ = projection[2][2] * P.z + projection[3][2];
    float clipW = projection[2][3] * P.z + projection[3][3];
    float ndcZ = clipZ / clipW;
    float depth = (ndcZ + 1.0) * 0.5;

    #ifdef GL_EXT_frag_depth
    gl_FragDepthEXT = depth;
    #else
    gl_FragDepth = depth;
    #endif
}

`;
