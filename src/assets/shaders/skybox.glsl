@vertex

#version 300 es

in vec3 a_position;

out vec3 v_direction;

uniform mat4 u_projection;
uniform mat4 u_view;

void main() {
    v_direction = a_position;

    vec4 clip_position = u_projection * u_view * vec4(a_position, 1.0);
    gl_Position = clip_position.xyww;
}

@fragment

#version 300 es
precision mediump float;

in vec3 v_direction;

out vec4 frag_colour;

uniform samplerCube u_skybox;

const float SKYBOX_ROTATION_RADIANS = 1.05;

vec3 rotate_y(vec3 direction, float radians) {
    float c = cos(radians);
    float s = sin(radians);
    return vec3(
        direction.x * c + direction.z * s,
        direction.y,
        -direction.x * s + direction.z * c
    );
}

void main() {
    vec3 rotated_direction = rotate_y(normalize(v_direction), SKYBOX_ROTATION_RADIANS);
    frag_colour = texture(u_skybox, rotated_direction);
}
