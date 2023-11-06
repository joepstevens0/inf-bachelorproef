precision highp float;

varying vec2 vTexCoord;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vCamPos;

uniform sampler2D uTexture;

vec4 getColor(vec3 normal){

    vec3 lightPos = vCamPos;
    
    normal = abs(normalize(normal));

    vec3 lightDir = abs(normalize(lightPos- vPos));

    float lightval = dot(lightDir, normal);
    if (lightval < 0.5) lightval = 1. - lightval;
    return vec4(vec3(0.8)*lightval, 1);

}

void main() {
    gl_FragColor = texture2D(uTexture, vTexCoord);
    // gl_FragColor = getColor(vNormal);

}