'use client'

import React, { useRef, useEffect, useState } from "react";
import { eigs, norm, transpose } from 'mathjs'

const Canvas = (props) => {

  const canvasRef = useRef(null);
  const canvasWidth = 900;
  const canvasHeight = 900;

  const imageRef = useRef(null)
  const [img_src, set_img_src] = useState("default.png");
  const [image_loaded, set_image_loaded] = useState(false);

  // hidden canvas (not displayed in DOM) used for image preprocessing
  const image_canvas_ref = useRef(null);
  const [image_processed, set_image_processed] = useState(false);

  // value between zero and one
  // respresents what percent the linear transformation has completed
  const [time, set_time] = useState(1);

  // linear transform matrix
  const [a, set_a] = useState(1);
  const [b, set_b] = useState(0);
  const [c, set_c] = useState(0);
  const [d, set_d] = useState(1);

  // convolution matrix
  const [kernel, set_kernel] = useState([
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0]
  ]);

  const [show_image, set_show_image] = useState(true)
  const [show_eigenvectors, set_show_eigenvectors] = useState(true)

  const updateImage = files => {
    if (files.length === 0) return;
    set_image_loaded(false);
    set_img_src(URL.createObjectURL(files[0]));
    set_image_processed(false);
  };

  const linear_transform_reset = () => {
    set_a(1);
    set_b(0);
    set_c(0);
    set_d(1);
  };

  const linear_transform_shear = () => {
    set_a(1);
    set_b(0);
    set_c(1);
    set_d(1);
  };

  const linear_transform_rotation = () => {
    set_a(0);
    set_b(1);
    set_c(-1);
    set_d(0);
  };

  const linear_transform_random = () => {
    // random number between -2 and 2, rounded to the nearest tenth
    set_a(Math.round((Math.random()*4-2)*10)/10);
    set_b(Math.round((Math.random()*4-2)*10)/10);
    set_c(Math.round((Math.random()*4-2)*10)/10);
    set_d(Math.round((Math.random()*4-2)*10)/10);
  }

  const set_kernel_idx = (new_val, i, j) => {
    set_image_processed(false);
    const new_kernel = kernel.map((row, row_idx) => {
      return row.map((val, col_idx) => {
        if (row_idx === i && col_idx === j) return new_val;
        else return val;
      });
    });
    set_kernel(new_kernel);
  }

  const convolution_reset = () => {
    set_image_processed(false);
    set_kernel([
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0]
    ]);
  };

  const convolution_sharpen = () => {
    set_image_processed(false);
    set_kernel([
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0]
    ]);
  };

  const convolution_box_blur = () => {
    set_image_processed(false);
    set_kernel([
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9]
    ]);
  }

  // this effect updates the (hidden) canvas that stores the convolved image
  useEffect(() => {
    if (!image_loaded) return;

    // calculate desired image dimentions
    const image = imageRef.current;
    let dImageWidth; // desired image width
    let dImageHeight; // desired image height
    if (image.width > image.height) {
      dImageWidth = 250;
      dImageHeight = image.height * 250/image.width;
    } else {
      dImageWidth = image.width * 250/image.height;
      dImageHeight = 250;
    }

    // (hidden) canvas used for processing and storing the image
    const image_canvas = image_canvas_ref.current;
    image_canvas.width = dImageWidth;
    image_canvas.height = dImageHeight;
    // draw the image on image_canvas and get its image data (pixel rgba values)
    const image_context = image_canvas.getContext("2d", {willReadFrequently: true});
    image_context.drawImage(image, 0, 0, dImageWidth, dImageHeight);
    const image_data = image_context.getImageData(0, 0, dImageWidth, dImageHeight);
    // apply convolution matrix to image data
    const new_pixels = convolution(image_data, kernel)
    const new_image_data = image_context.createImageData(dImageWidth, dImageHeight);
    new_image_data.data.set(new_pixels);
    // paint new image data back onto image_canvas
    image_context.putImageData(new_image_data, 0, 0);

    set_image_processed(true);
  }, [image_loaded, kernel]);

  // this effect updates the main canvas
  useEffect(() => {
    if (!image_processed) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", {willReadFrequently: true});
    context.save();
    // calculate the actual transform values (dependent on the time variable)
    const time_a = 1+(a-1)*time
    const time_b = -b*time
    const time_c = -c*time
    const time_d = 1+(d-1)*time
    // coordinates of the origin
    const originX = 450, originY = 450;

    // clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // move the origin to the center of the canvas
    context.translate(originX, originY);

    // draw the background grid (this grid remains static during linear tranformations)
    draw_background_grid(context);

    // linearly transform the canvas
    context.transform(time_a, time_b, time_c, time_d, 0, 0);
    
    // draw_foreground_grid needs to (multiple times) call context.restore() and then bring
    // the context back to its transformed state, so we provide it with this callback function
    const transform_context = () => context.transform(time_a, time_b, time_c, time_d, originX, originY);
    
    // draw the foreground grid (this grid is linearly transformed along with the image)
    draw_foreground_grid(context, transform_context);

    // reference canvas used for image preprocessing (aka convolution)
    const image_canvas = image_canvas_ref.current;
    // draw the image
    if (show_image) {
      context.drawImage(image_canvas, 0, -image_canvas.height); // img, x, y
    }
    
    context.restore();
    context.save();
    context.translate(originX, originY);

    try {
      // draw the eigenvectors
      if (!show_eigenvectors) { return; }
      const {values, vectors} = eigs([[a, c], [b, d]])
      let [val1, val2] = values
      let [vec1, vec2] = transpose(vectors)
      if (typeof vec1[0] !== 'number') { return; }

      if (vec1[0] < 0) vec1 = vec1.map(x => x * -1)
      if (vec2[0] < 0) vec2 = vec2.map(x => x * -1)

      vec1 = vec1.map(x => {
        x = x/norm(vec1)
        return x + (x*val1 - x)*time
      })
      vec2 = vec2.map(x => {
        x = x/norm(vec2)
        return x + (x*val2 - x)*time
      })

      for (let i = 0; i < 60; i++) {
        draw_arrow(context, 80*vec1[0]*i, -80*vec1[1]*i, 80*vec1[0]*(i+1), -80*vec1[1]*(i+1), "rgb(246, 194, 138)");
        draw_arrow(context, -80*vec1[0]*i, 80*vec1[1]*i, -80*vec1[0]*(i+1), 80*vec1[1]*(i+1), "rgb(246, 194, 138)");
        draw_arrow(context, 80*vec2[0]*i, -80*vec2[1]*i, 80*vec2[0]*(i+1), -80*vec2[1]*(i+1), "rgb(246, 194, 138)");
        draw_arrow(context, -80*vec2[0]*i, 80*vec2[1]*i, -80*vec2[0]*(i+1), 80*vec2[1]*(i+1), "rgb(246, 194, 138)");
      }
    } catch (error) {
    } finally {
      // draw the x and y unit vectors
      draw_arrow(context, 0, 0, 80*time_a, 80*time_b, "rgb(151, 187, 110)");
      draw_arrow(context, 0, 0, -80*time_c, -80*time_d, "rgb(239, 131, 101)");

      context.restore();
    }
  }, [image_processed, time, a, b, c, d, show_image, show_eigenvectors]);

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img hidden src={img_src} ref={imageRef} onLoad={() => set_image_loaded(true)} alt=""/>
      <canvas hidden ref={image_canvas_ref} />
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight}/>
      <br />
      <input type="file" accept="image/*" onChange={e => updateImage(e.target.files)}></input>
      <button onClick={() => set_show_image(!show_image)}> {show_image ? 'Hide image' : 'Show image'} </button>
      <button onClick={() => set_show_eigenvectors(!show_eigenvectors)}> {show_eigenvectors ? 'Hide eigenvectors' : 'Show eigenvectors'} </button>
      <br />
      <input type="range" min="0" max="1" step="0.01" value={time} onChange={e => set_time(e.target.value)}></input>
      <br />
      <button onClick={linear_transform_reset}>Reset</button>
      <button onClick={linear_transform_shear}>Shear</button>
      <button onClick={linear_transform_rotation}>Rotation</button>
      <button onClick={linear_transform_random}>Random</button>
      <br />
      Transform Matrix
      <br />
      <input type="number" name="a" value={a} onChange={e => set_a(e.target.value)} ></input>
      <input type="number" name="c" value={c} onChange={e => set_c(e.target.value)} ></input>
      <br />
      <input type="number" name="b" value={b} onChange={e => set_b(e.target.value)} ></input>
      <input type="number" name="d" value={d} onChange={e => set_d(e.target.value)} ></input>
      <br />
      Convolution Matrix
      <br />
      <button onClick={convolution_reset}>Reset</button>
      <button onClick={convolution_sharpen}>Sharpen</button>
      <button onClick={convolution_box_blur}>Box Blur</button>
      <br />
      <input type="number" name="kernel_a" value={kernel[0][0]} onChange={e => set_kernel_idx(e.target.value, 0, 0)} ></input>
      <input type="number" name="kernel_d" value={kernel[0][1]} onChange={e => set_kernel_idx(e.target.value, 0, 1)} ></input>
      <input type="number" name="kernel_g" value={kernel[0][2]} onChange={e => set_kernel_idx(e.target.value, 0, 2)} ></input>
      <br />
      <input type="number" name="kernel_b" value={kernel[1][0]} onChange={e => set_kernel_idx(e.target.value, 1, 0)} ></input>
      <input type="number" name="kernel_e" value={kernel[1][1]} onChange={e => set_kernel_idx(e.target.value, 1, 1)} ></input>
      <input type="number" name="kernel_h" value={kernel[1][2]} onChange={e => set_kernel_idx(e.target.value, 1, 2)} ></input>
      <br />
      <input type="number" name="kernel_c" value={kernel[2][0]} onChange={e => set_kernel_idx(e.target.value, 2, 0)} ></input>
      <input type="number" name="kernel_f" value={kernel[2][1]} onChange={e => set_kernel_idx(e.target.value, 2, 1)} ></input>
      <input type="number" name="kernel_i" value={kernel[2][2]} onChange={e => set_kernel_idx(e.target.value, 2, 2)} ></input>
      <br />
    </div>
  );
};

function draw_background_grid(context) {
  // faint grey grid lines
  context.beginPath();
  for (let x = 0; x < 450; x+=40) {
    context.moveTo(x, -450);
    context.lineTo(x, 450);
    context.moveTo(-x, -450);
    context.lineTo(-x, 450);
  }
  for (let y = 0; y < 450; y+=40) {
    context.moveTo(-450, y);
    context.lineTo(450, y);
    context.moveTo(-450, -y);
    context.lineTo(450, -y);
  }
  context.strokeStyle = "rgb(30, 30, 30)";
  context.lineWidth = 2;
  context.stroke();
  // bold grey grid lines
  context.beginPath();
  for (let x = 0; x < 450; x+=80) {
    context.moveTo(x, -450);
    context.lineTo(x, 450);
    context.moveTo(-x, -450);
    context.lineTo(-x, 450);
  }
  for (let y = 0; y < 450; y+=80) {
    context.moveTo(-450, y);
    context.lineTo(450, y);
    context.moveTo(-450, -y);
    context.lineTo(450, -y);
  }
  context.strokeStyle = "rgb(58, 58, 58)";
  context.lineWidth = 2;
  context.stroke();
}

function draw_foreground_grid(context, transform_context) {
  // blue grid lines
  context.beginPath();
  for (let x = 80; x < 4500; x+=80) {
    context.moveTo(x, -4500);
    context.lineTo(x, 4500);
    context.moveTo(-x, -4500);
    context.lineTo(-x, 4500);
  }
  for (let y = 80; y < 4500; y+=80) {
    context.moveTo(-4500, y);
    context.lineTo(4500, y);
    context.moveTo(-4500, -y);
    context.lineTo(4500, -y);
  }
  // we have to call restore() before stroke() so the linewidth 
  // is not affected by the transform
  context.restore();
  context.save();
  context.strokeStyle = "rgb(69, 146, 165)";
  context.lineWidth = 2;
  context.stroke();
  // return the canvas to its linearly transformed state
  transform_context();

  // x and y axis
  context.beginPath();
  context.moveTo(0, -4500);
  context.lineTo(0, 4500);
  context.moveTo(-4500, 0);
  context.lineTo(4500, 0);
  // we have to call restore() before stroke() so the linewidth 
  // is not affected by the transform
  context.restore();
  context.save();
  context.strokeStyle = "rgb(255, 255, 255)";
  context.lineWidth = 2;
  context.stroke();
  // return the canvas to its linearly transformed state
  transform_context();
}

function draw_arrow(context, x0, y0, x1, y1, color) {
  const width = 6;
  const head_len = 14;
  const head_angle = Math.PI / 7;
  const angle = Math.atan2(y1 - y0, x1 - x0);

  context.lineWidth = width;
  context.strokeStyle = color;
  context.fillStyle = color;

  /* Adjust the point */
  x1 -= width * Math.cos(angle);
  y1 -= width * Math.sin(angle);

  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.stroke();

  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x1 - head_len * Math.cos(angle - head_angle), y1 - head_len * Math.sin(angle - head_angle));
  context.lineTo(x1 - head_len * Math.cos(angle + head_angle), y1 - head_len * Math.sin(angle + head_angle));
  context.closePath();
  context.stroke();
  context.fill();
}

function convolution(imageData, kernel) {

  const numCols = imageData.width;
  const numRows = imageData.height;
  const pixels = imageData.data;
  const kernelSize = kernel.length;

  const result = [...pixels];

  // Iterate over each pixel in the matrix
  for (let row = 0; row < numRows - kernelSize + 1; row++) {
    for (let col = 0; col < numCols - kernelSize + 1; col++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
      // Apply the kernel to the sub-matrix of pixels
      for (let i = 0; i < kernelSize; i++) {
        for (let j = 0; j < kernelSize; j++) {
          const pixel_idx = (numCols * (row + i) + (col + j)) * 4;
          const kernelValue = kernel[i][j];
          sumR += pixels[pixel_idx + 0] * kernelValue;
          sumG += pixels[pixel_idx + 1] * kernelValue;
          sumB += pixels[pixel_idx + 2] * kernelValue;
          sumA += pixels[pixel_idx + 3] * kernelValue;
        }
      }
      const result_idx = (numCols * row + col) * 4;
      result[result_idx + 0] = sumR;
      result[result_idx + 1] = sumG;
      result[result_idx + 2] = sumB;
      result[result_idx + 3] = sumA;
    }
  }

  return result;
}

export default Canvas;
