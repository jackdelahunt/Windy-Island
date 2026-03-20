@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position.xy * 2.0, 0.0, 1.0);
}

@fragment

#version 300 es
precision highp float;

in vec2 v_uv;

out vec4 frag_colour;

uniform sampler2D u_scene_texture;

const float GAMMA = 2.2;

void main() {
    vec4 scene_colour = texture(u_scene_texture, v_uv);
    vec3 gamma_corrected = pow(scene_colour.rgb, vec3(1.0 / GAMMA));
    frag_colour = vec4(gamma_corrected, scene_colour.a);
}
