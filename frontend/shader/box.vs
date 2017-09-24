precision highp float;

attribute vec3 a_position;

uniform mat3 u_xform;
uniform float u_time;

void main () {
    vec3 pos = a_position;
    pos.z -= u_time;
    pos = u_xform * pos;
    gl_Position = vec4(pos.xy, 0.1, 1.0);
}

