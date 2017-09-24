precision mediump float;

varying vec2 v_texcoord;
varying float v_depth;

uniform sampler2D u_sampler;

void main () {
    const vec3 MIST = vec3(0.1, 0.1, 0.25);
    vec3 tex = texture2D(u_sampler, v_texcoord).rgb;
    vec3 color = mix(tex, MIST, v_depth);
    gl_FragColor = vec4(color, 1.0);
}

