import { crystal, pigment, type Renderer } from "./field";

// The analytic gradient of each merged field supplies one normal for the
// whole visible pixel. One refracted coordinate, also where the layers cross.
const field = (name: string, n: number) => `
uniform vec3 ${name}[${n}];
vec3 field_${name}(vec2 p){
  vec2 grad = vec2(0.); float f = 0.;
  for(int i=0; i<${n}; i++){
    vec2 d = p - ${name}[i].xy;
    float inv = 1. / (dot(d,d) + 0.00001);
    float k = ${name}[i].z * ${name}[i].z * inv;
    f += k; grad -= 2. * k * inv * d;
  }
  float len = max(length(grad), 0.00001);
  // Distance to the isoline of a radial inverse-square field. Unlike the
  // linear estimate it stays positive inside the core (no false central rims).
  float depth = (f-1.) / len * (2.*f/(sqrt(f)+1.));
  return vec3(-grad / len, depth);
}`;
const fragment = `
precision highp float;
uniform vec2 res;
uniform float unit, pearl, clearGlass, shine;
uniform vec3 ground, accent;
const vec2 lamp = vec2(-.62,.78);
${field("dye", pigment.length)}
${field("glass", crystal.length)}
vec3 bg(vec2 p){
  vec2 d = p - vec2(.45,.23), e = p + vec2(.60,.40);
  float glow = .19*exp(-2.8*dot(d,d)) + .09*exp(-4.*dot(e,e));
  vec3 c = mix(ground,accent,glow);
  vec2 grid = abs(fract(p/.085+.5)-.5)*.085;
  c += mix(.016,-.018,pearl)*(1.-smoothstep(.0004,1.1/unit,min(grid.x,grid.y)));
  return c*(1.-.13*smoothstep(.55,1.5,length(p)));
}
float reflection(vec3 edge,float bezel){
  float s = max(0.,edge.z), facing = dot(edge.xy,lamp);
  float key = pow(max(facing,0.),1.7), fill = pow(max(-facing,0.),2.2);
  float rim = 1.-smoothstep(0.,max(.0042,1.4/unit),s);
  float shoulder = 1.-smoothstep(0.,bezel,s);
  return shine*(rim*(.10+.78*key+.46*fill) + .12*shoulder*(key+fill)
           + .14*fill*smoothstep(.10,.40,shoulder)*(1.-smoothstep(.52,.92,shoulder)));
}
vec3 dyed(vec2 p){
  vec3 e = field_dye(p), under = bg(p);
  float mask = smoothstep(-1.1/unit,1.1/unit,e.z);
  if(mask<=0.) return under;
  float lip = 1.-smoothstep(0.,.075,e.z);
  vec2 off = e.xy * lip*lip*.07;
  vec3 sampleColor = bg(p + off); // one lookup for the whole RGB pixel
  float pigmentLoad = mix(.60/(1.+.46*dot(accent,vec3(.213,.715,.072))),.42,pearl);
  vec3 ink = mix(sampleColor,accent, pigmentLoad * (.62+.38*(1.-lip)) * mix(1.,.39,clearGlass));
  return mix(under, mix(ink,vec3(1.),reflection(e,.036)),mask);
}
void main(){
  vec2 p = (gl_FragCoord.xy-.5*res) / unit;
  vec3 e = field_glass(p), under = dyed(p);
  float mask = smoothstep(-1.1/unit,1.1/unit,e.z);
  if(mask>0.){
    float lip = 1.-smoothstep(0.,.08,e.z);
    vec3 through = dyed(p + e.xy * lip*lip*.085);
    vec3 silver = mix(through,vec3(mix(.45,.99,pearl)),.16+.10*(1.-lip));
    under = mix(under,mix(silver,vec3(1.),reflection(e,.042)),mask);
  }
  gl_FragColor = vec4(under,1.);
}`;

export function webglRenderer(gl: WebGLRenderingContext): Renderer | null {
  const program = gl.createProgram();
  if (!program) return null;
  function attach(type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return false;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (ok) gl.attachShader(program!, shader);
    gl.deleteShader(shader); // released as soon as its program is released
    return ok;
  }
  const compiled =
    attach(gl.VERTEX_SHADER, "attribute vec2 pos; void main(){gl_Position=vec4(pos,0.,1.);}") &&
    attach(gl.FRAGMENT_SHADER, fragment);
  if (compiled) gl.linkProgram(program);
  if (!compiled || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, "pos");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const [res, unit, dye, glass, ground, accent, pearl, clear, shine] = [
    "res",
    "unit",
    "dye[0]",
    "glass[0]",
    "ground",
    "accent",
    "pearl",
    "clearGlass",
    "shine",
  ].map((n) => gl.getUniformLocation(program, n));
  return {
    draw(w, h, u, a, b, light) {
      gl.viewport(0, 0, w, h);
      gl.uniform2f(res, w, h);
      gl.uniform1f(unit, u);
      gl.uniform3fv(dye, a);
      gl.uniform3fv(glass, b);
      gl.uniform3fv(ground, light.ground);
      gl.uniform3fv(accent, light.accent);
      gl.uniform1f(pearl, light.pearl);
      gl.uniform1f(clear, light.clear);
      gl.uniform1f(shine, light.shine);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.useProgram(null);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
