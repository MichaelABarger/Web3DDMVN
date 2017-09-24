precision mediump float;

attribute vec3 a_position;
attribute vec2 a_texcoord;

varying vec2 v_texcoord;
varying float v_depth;

uniform mat3 u_xform;

void main () {
    v_texcoord = a_texcoord;
    vec3 xformed = u_xform * a_position;
    v_depth = -xformed.z;
    gl_Position = vec4(xformed.xy, 0.0, 1.0);
}

