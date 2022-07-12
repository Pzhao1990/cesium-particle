varying float heightNormalization;
uniform sampler2D colorTable;
uniform bool colour;

varying float speedNormalization;

void main() {
  if(speedNormalization > 0.0){
    if(colour){
      gl_FragColor = texture2D(colorTable, vec2(heightNormalization, 0.0));
    } else {
      gl_FragColor = texture2D(colorTable, vec2(speedNormalization, 0.0));
    }

    //色例配置
    /*if(speedNormalization>0.0 && speedNormalization<5.0){
       gl_FragColor =  vec4(1.0,0.0,0.0,1.0);
    } else if(speedNormalization>=5.0 && speedNormalization<10.0){
        gl_FragColor =  vec4(0.0,1.0,0.0,1.0);
    } else if(speedNormalization>=10.0 && speedNormalization<15.0){
        gl_FragColor =  vec4(0.0,0.0,1.0,1.0);
    }*/

  } else {
    gl_FragColor = vec4(0.0);
  }
}