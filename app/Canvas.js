import React, { useRef, useEffect, useState } from "react";
import Image from 'next/image';
import { eigs, norm } from 'mathjs';
import { Matrix, SingularValueDecomposition, determinant } from 'ml-matrix';

const Canvas = (props) => {

  const canvasRef = useRef(null);
  const canvasWidth = 900;
  const canvasHeight = 900;
  const originX = canvasWidth/2, originY = canvasHeight/2;
  const target_radius = 14;

  const imageRef = useRef(null)

  const img_choices = [1, 2, 3, 4]
  var img_choice = img_choices[Math.floor(Math.random()*img_choices.length)];
  const [img_src, set_img_src] = useState(img_choice+".jpg");
  const [image_loaded, set_image_loaded] = useState(false);

  // hidden canvas (not displayed in DOM) used for image preprocessing
  const image_canvas_ref = useRef(null);
  const [image_processed, set_image_processed] = useState(false);

  // between 0 and 1, respresents what percent the linear transformation has completed
  const [time, set_time] = useState(0);
  // represents whether the linear transformation animation is shown happening linearly, or using SVD
  const [transition_type, set_transition_type] = useState('linear');

  // linear transform matrix
  const [a, set_a] = useState(1);
  const [b, set_b] = useState(-.5);
  const [c, set_c] = useState(-.5);
  const [d, set_d] = useState(1);

  // convolution matrix
  const [kernel, set_kernel] = useState([
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0]
  ]);

  const [show_unit_circle, set_show_unit_circle] = useState(true);
  const [show_image, set_show_image] = useState(false);
  const [show_eigenvectors, set_show_eigenvectors] = useState(true);
  
  // is x/y target selected (clicked on)
  const [x_target_selected, set_x_target_selected] = useState(false)
  const [y_target_selected, set_y_target_selected] = useState(false)
  // if x/y target is selected, what is the coordinate offset between the cursor and the center of the x/y target
  const [x_target_click_offset, set_x_target_click_offset] = useState(null)
  const [y_target_click_offset, set_y_target_click_offset] = useState(null)

  const updateImage = files => {
    if (files.length === 0) return;
    set_image_loaded(false);
    set_img_src(URL.createObjectURL(files[0]));
    set_image_processed(false);
  };

  const linear_transform_identity = () => {
    set_a(1);
    set_b(0);
    set_c(0);
    set_d(1);
  };

  const linear_transform_shear = () => {
    set_a(1.5);
    set_b(0);
    set_c(.5);
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

  const handle_mouse_down = event => {
    const canvas = canvasRef.current;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouse_coords = [
      event.nativeEvent.offsetX*scaleX-originX, 
      event.nativeEvent.offsetY*scaleY-originY
    ]

    const x_target_coords = [a*80, -b*80]
    const y_target_coords = [c*80, -d*80]

    // (Δx, Δy) distance between the cursor and the x/y target
    const x_target_offset = [mouse_coords[0]-x_target_coords[0], mouse_coords[1]-x_target_coords[1]]
    const y_target_offset = [mouse_coords[0]-y_target_coords[0], mouse_coords[1]-y_target_coords[1]]
    // magnitude of distance between where the cursor and the x/y target
    const dist_to_x_target = Math.hypot(...x_target_offset)
    const dist_to_y_target = Math.hypot(...y_target_offset)


    if (dist_to_x_target <= target_radius*3 && dist_to_y_target <= target_radius*3) {
      if (dist_to_x_target < dist_to_y_target) {
        set_x_target_selected(true)
        set_x_target_click_offset(x_target_offset)
      } else {
        set_y_target_selected(true)
        set_y_target_click_offset(y_target_offset)
      }
    } else if (dist_to_x_target <= target_radius*3) {
      set_x_target_selected(true)
      set_x_target_click_offset(x_target_offset)
    } else if (dist_to_y_target <= target_radius*3) {
      set_y_target_selected(true)
      set_y_target_click_offset(y_target_offset)
    }
  }

  const handle_mouse_up = () => {
    set_x_target_selected(false)
    set_y_target_selected(false)
  }

  const handle_mouse_move = event => {
    const canvas = canvasRef.current;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouse_coords = [
      event.nativeEvent.offsetX*scaleX-originX, 
      event.nativeEvent.offsetY*scaleY-originY
    ]

    const x_target_coords = [a*80, -b*80]
    const y_target_coords = [c*80, -d*80]

    // (Δx, Δy) distance between the cursor and the x/y target
    const x_target_offset = [mouse_coords[0]-x_target_coords[0], mouse_coords[1]-x_target_coords[1]]
    const y_target_offset = [mouse_coords[0]-y_target_coords[0], mouse_coords[1]-y_target_coords[1]]
    // magnitude of distance between where the cursor and the x/y target
    const dist_to_x_target = Math.hypot(...x_target_offset)
    const dist_to_y_target = Math.hypot(...y_target_offset)

    if (x_target_selected || y_target_selected) {
      canvas.style.cursor = 'none';
    } else if (dist_to_x_target <= target_radius*3 || dist_to_y_target <= target_radius*3) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'default';
    }

    const round = num => Math.round(num * 100) / 100;

    if (x_target_selected) {
      const x_target_coords = [mouse_coords[0]-x_target_click_offset[0], mouse_coords[1]-x_target_click_offset[1]]
      set_a(round(x_target_coords[0]/80))
      set_b(round(-x_target_coords[1]/80))
    } else if (y_target_selected) {
      const y_target_coords = [mouse_coords[0]-y_target_click_offset[0], mouse_coords[1]-y_target_click_offset[1]]
      set_c(round(y_target_coords[0]/80))
      set_d(round(-y_target_coords[1]/80))
    }
  }

  // this effect updates the (hidden) canvas that stores the convolved image
  useEffect(() => {
    if (!image_loaded) return;

    // calculate desired image dimensions
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

    // clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // move the origin to the center of the canvas
    context.translate(originX, originY);

    // draw the background grid (this grid remains static during linear tranformations)
    draw_background_grid(context);

    // calculate the actual transform values (dependent on the time variable)
    let timed_vals = null;
    if (transition_type === 'linear') timed_vals = timed_vals_linear(a, b, c, d, time);
    else timed_vals = timed_vals_svd(a, b, c, d, time);
    const [
      [time_a, time_c],
      [time_b, time_d]
    ] = timed_vals;

    // linearly transform the canvas
    context.transform(time_a, -time_b, -time_c, time_d, 0, 0);
    
    // draw_foreground_grid needs to (multiple times) call context.restore() and then bring
    // the context back to its transformed state, so we provide it with this callback function
    const transform_context = () => context.transform(time_a, -time_b, -time_c, time_d, originX, originY);
    
    // draw the foreground grid (this grid is linearly transformed along with the image but must keep its linewidth constant)
    draw_foreground_grid(context, transform_context);
    // draw the unit circle (this circle is linearly transformed along with the image but must keep its linewidth constant)
    if (show_unit_circle) draw_unit_circle(context, transform_context);

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
      if (!show_eigenvectors) { return; }
      // compute eigenvectors
      const {eigenvectors: eigenPairs} = eigs([[a, c], [b, d]]) // eigs() throws error if no eigenvectors

      // check if eigenvectors are real (not imaginary)
      if (typeof eigenPairs[0].vector[0] !== 'number') { 
        return; 
      }

      // set magnitude of eigenvectors using "time" value ("time" value represents slider position)
      for (let eigenPair of eigenPairs) {
        eigenPair.vector = eigenPair.vector.map(x => {
          x = x/norm(eigenPair.vector)
          return x + (x*eigenPair.value - x)*time
        })
      }

      // draw the eigenvectors
      for (let i = 0; i < 60; i++) {
        for (let eigenPair of eigenPairs) {
          const vec = eigenPair.vector
          draw_arrow(context, 80*vec[0]*i, -80*vec[1]*i, 80*vec[0]*(i+1), -80*vec[1]*(i+1), "rgb(246, 194, 138)");
          draw_arrow(context, -80*vec[0]*i, 80*vec[1]*i, -80*vec[0]*(i+1), 80*vec[1]*(i+1), "rgb(246, 194, 138)");
        }
      }
    } catch (error) {
      console.log('eigs() threw an error', error);
    } finally {
      // draw the x and y unit vectors
      draw_arrow(context, 0, 0, 80*time_a, -80*time_b, "rgb(151, 187, 110)");
      draw_arrow(context, 0, 0, 80*time_c, -80*time_d, "rgb(239, 131, 101)");

      // draw the targets that you can drag to change the linear transform matrix
      draw_target(context, a*80, -b*80, target_radius, "rgb(151, 187, 110)")
      draw_target(context, c*80, -d*80, target_radius, "rgb(239, 131, 101)")

      context.restore();
    }
  }, [image_processed, time, transition_type, a, b, c, d, originX, originY, show_unit_circle, show_image, show_eigenvectors]);

  return (
    <div className="bg-gradient-to-r from-gray-100 to-gray-300 min-h-screen flex flex-col justify-between">
      <div id="main-content" className="flex justify-center items-center flex-wrap gap-8 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img hidden src={img_src} ref={imageRef} onLoad={() => set_image_loaded(true)} alt=""/>
        {/* hidden canvas */}
        <canvas hidden ref={image_canvas_ref}/> {/* canvas used for image convolution */}
        {/* visible canvas */}
        <canvas
          className="bg-black min-w-0 max-w-4xl"
          style={{"flex": "1 1 60%", "touchAction": "none"}}
          width={canvasWidth} height={canvasHeight} // canvas's internal resolution
          ref={canvasRef} 
          onPointerDown={event => handle_mouse_down(event)} 
          onPointerMove={event => handle_mouse_move(event)}
          onPointerUp={handle_mouse_up}
        />
        {/* card */}
        <div className="relative bg-white p-8 rounded-lg shadow-lg max-w-xl" style={{"flex": "1 1 25%"}} > 
          <div className="absolute group top-4 right-4 text-xl">
            &#9432;
            <div class="absolute top-0 right-0 mb-2 hidden w-80 px-2 py-1 text-white text-sm bg-gray-800 rounded shadow-lg group-hover:block">
              Explore matrix transformations with our interactive visualizer. 
              <br/>
              <br/>
              Drag the green/red targets to adjust the linear transform, apply different convolutions, and see the math in action.
              <br/>
              <br/>
              Mobile friendly.
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center">Matrix Playground</h1>
          <h2 className="text-sm text-slate-500 mb-3 text-center">
            Inspired by <a href="https://www.3blue1brown.com" className="hover:underline">3Blue1Brown</a>
          </h2>
          <div className="flex flex-wrap mb-2 items-center">
            <div className="mb-2 mr-4 flex min-w-fit">
              <h2 className="mr-2 text-xl font-semibold">Drag me:</h2>
              <input className="" type="range" min="0" max="1" step="0.01" value={time} onChange={e => set_time(e.target.value)}></input>
            </div>
            <div className="mb-2">
              <span>Transition:</span>
              <button
                className={`ml-2 px-4 py-2 border rounded ${transition_type === 'linear' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
                onClick={() => set_transition_type('linear')}
              >
                Linear
              </button>
              <button
                className={`ml-2 px-4 py-2 border rounded ${transition_type === 'SVD' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
                onClick={() => set_transition_type('SVD')}
              >
                SVD
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mb-4"> {/*container for hide eigenv, hide img, change img buttons*/}
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded" onClick={() => set_show_unit_circle(!show_unit_circle)}> {show_unit_circle ? 'Hide unit circle' : 'Show unit circle'} </button>
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded" onClick={() => set_show_eigenvectors(!show_eigenvectors)}> {show_eigenvectors ? 'Hide eigenvectors' : 'Show eigenvectors'} </button>
          </div>
          <h2 className="text-xl font-semibold mb-4">Linear Transform Matrix</h2>
          <div className="flex flex-wrap gap-4 mb-4">
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded" onClick={linear_transform_identity}>Identity</button>
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded" onClick={linear_transform_shear}>Shear</button>
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded" onClick={linear_transform_rotation}>Rotation</button>
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded" onClick={linear_transform_random}>Random</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <input className="border rounded p-2 text-center" type="number" name="a" value={a} onChange={e => set_a(e.target.value)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="c" value={c} onChange={e => set_c(e.target.value)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="b" value={b} onChange={e => set_b(e.target.value)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="d" value={d} onChange={e => set_d(e.target.value)} ></input>
          </div>
          <h2 className="text-xl font-semibold mb-4">Convolution Matrix</h2>
          <div className="flex gap-4 mb-4">
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded" onClick={() => set_show_image(!show_image)}> {show_image ? 'Hide image' : 'Show image'} </button>
            <label className="bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
              <input hidden type="file" accept="image/*" onChange={e => updateImage(e.target.files)} />
              Change image
            </label>
          </div>
          <div className="flex gap-4 mb-4">
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded" onClick={convolution_reset}>Reset</button>
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded" onClick={convolution_sharpen}>Sharpen</button>
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded" onClick={convolution_box_blur}>Box Blur</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="border rounded p-2 text-center" type="number" name="kernel_a" value={kernel[0][0]} onChange={e => set_kernel_idx(e.target.value, 0, 0)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_d" value={kernel[0][1]} onChange={e => set_kernel_idx(e.target.value, 0, 1)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_g" value={kernel[0][2]} onChange={e => set_kernel_idx(e.target.value, 0, 2)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_b" value={kernel[1][0]} onChange={e => set_kernel_idx(e.target.value, 1, 0)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_e" value={kernel[1][1]} onChange={e => set_kernel_idx(e.target.value, 1, 1)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_h" value={kernel[1][2]} onChange={e => set_kernel_idx(e.target.value, 1, 2)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_c" value={kernel[2][0]} onChange={e => set_kernel_idx(e.target.value, 2, 0)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_f" value={kernel[2][1]} onChange={e => set_kernel_idx(e.target.value, 2, 1)} ></input>
            <input className="border rounded p-2 text-center" type="number" name="kernel_i" value={kernel[2][2]} onChange={e => set_kernel_idx(e.target.value, 2, 2)} ></input>
          </div>
        </div>
      </div>
      <footer className="mb-2 mx-2 flex flex-wrap justify-center">
        <span className="mr-1">
          Made by <a href="https://x.com/ishaancjain" className="text-slate-600 hover:underline">Ishaan Jain</a>,
        </span>
        <span className="mr-1">
          using
          <Image src="React-icon.svg" alt="" width={16} height={16} className="mx-1 inline"></Image>
          React,
          <Image src="Tailwind-icon.svg" alt="" width={16} height={16} className="mx-1 inline"></Image>
          Tailwind, and
          <Image src="HTML5-icon.svg" alt="" width={16} height={16} className="mx-1 inline"></Image>
          canvas.
        </span>
        <span className="">
          Would love <a href="mailto:ishaancj@proton.me" target="_blank" className="text-slate-600 hover:underline">feedback</a>
          !
        </span>
      </footer>
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
  // we have to call restore() before stroke() so the linewidth is not affected by the transform
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
  // we have to call restore() before stroke() so the linewidth is not affected by the transform
  context.restore();
  context.save();
  context.strokeStyle = "rgb(255, 255, 255)";
  context.lineWidth = 2;
  context.stroke();
  // return the canvas to its linearly transformed state
  transform_context();
}

function draw_unit_circle(context, transform_context) {
  context.beginPath();
  context.arc(0, 0, 80, 0, 2*Math.PI);
  // we have to call restore() before stroke() so the linewidth is not affected by the transform
  context.restore();
  context.save();
  context.strokeStyle = "rgb(255, 255, 255)";
  context.lineWidth = 2;
  context.stroke();
  // return the canvas to its linearly transformed state
  transform_context();
}

function draw_arrow(context, x0, y0, x1, y1, color) {
  const width = 5;
  const head_len = 10;
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

function draw_target(context, x, y, radius, color) {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI)
  context.moveTo(x+7, y)
  context.lineTo(x+21, y)
  context.moveTo(x-7, y)
  context.lineTo(x-21, y)
  context.moveTo(x, y+7)
  context.lineTo(x, y+21)
  context.moveTo(x, y-7)
  context.lineTo(x, y-21)
  context.lineWidth = 4;
  context.strokeStyle = color;
  context.stroke();
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

const zip = (a, b) => a.map((k, i) => [k, b[i]]);

// computes the actual transform values (dependent on time) with a linear transition
function timed_vals_linear(a, b, c, d, time) {
  return zip(
    linear_interp([1, 0], [a, b], time),
    linear_interp([0, 1], [c, d], time),
  );
}

// computes the actual transform values (dependent on time) with a transition that showcases SVD
function timed_vals_svd(a, b, c, d, time) {
  const M = new Matrix([
    [a*1, c*1],
    [b*1, d*1],
  ]);

  const SVD = new SingularValueDecomposition(M)
  const U = SVD.leftSingularVectors;
  const S = SVD.diagonalMatrix;
  const V_t = SVD.rightSingularVectors.transpose();

  if (time <= 1/3) {
    if (determinant(V_t) < 0) {
      return zip(
        spherical_interp([1, 0], V_t.getColumn(1), time*3),
        spherical_interp([0, 1], V_t.getColumn(0), time*3)
      );
    }
    return zip(
      spherical_interp([1, 0], V_t.getColumn(0), time*3),
      spherical_interp([0, 1], V_t.getColumn(1), time*3)
    );
  } else if (time <= 2/3) {
    return zip(
      linear_interp(V_t.getColumn(0), S.mmul(V_t).getColumn(0), (time-1/3)*3),
      linear_interp(V_t.getColumn(1), S.mmul(V_t).getColumn(1), (time-1/3)*3),
    );
  } else {
    if (determinant(U) < 0) {
      return zip(
        spherical_interp(S.mmul(V_t).getColumn(1), [a, b], (time-2/3)*3),
        spherical_interp(S.mmul(V_t).getColumn(0), [c, d], (time-2/3)*3)
      );
    }
    return zip(
      spherical_interp(S.mmul(V_t).getColumn(0), [a, b], (time-2/3)*3),
      spherical_interp(S.mmul(V_t).getColumn(1), [c, d], (time-2/3)*3)
    );
  }
}

// linearly interpolates between two vectors
function linear_interp(vector1, vector2, time) {
  // Interpolating between vector1 and vector2
  const interpolatedVector = [
    (1 - time) * vector1[0] + time * vector2[0],
    (1 - time) * vector1[1] + time * vector2[1]
  ];
  
  return interpolatedVector;
}

// interpolates between two vectors on the surface of a sphere and maintains a constant angular velocity
function spherical_interp(vector1, vector2, time) {
  // Compute the magnitudes of vector1 and vector2
  const mag1 = Math.sqrt(vector1[0] ** 2 + vector1[1] ** 2);
  const mag2 = Math.sqrt(vector2[0] ** 2 + vector2[1] ** 2);

  // Normalize the input vectors
  const norm1 = [vector1[0] / mag1, vector1[1] / mag1];
  const norm2 = [vector2[0] / mag2, vector2[1] / mag2];

  // Compute the dot product between the normalized vectors
  const dot = norm1[0] * norm2[0] + norm1[1] * norm2[1];

  // Clamp the dot product to avoid precision errors
  const clampedDot = Math.min(Math.max(dot, -1), 1);

  // Compute the angle between the two normalized vectors
  const theta = Math.acos(clampedDot) * time;

  // Compute the perpendicular vector to norm1 in the plane of norm1 and norm2
  const perpendicularVector = [
    norm2[0] - norm1[0] * clampedDot,
    norm2[1] - norm1[1] * clampedDot,
  ];

  // Calculate the magnitude of the perpendicular vector
  const perpendicularMagnitude = Math.sqrt(perpendicularVector[0] ** 2 + perpendicularVector[1] ** 2);

  // Normalize the perpendicular vector
  const normalizedPerpendicular = [
    perpendicularVector[0] / perpendicularMagnitude,
    perpendicularVector[1] / perpendicularMagnitude,
  ];

  // Perform slerp between the normalized vectors
  const slerpedDirection = [
    norm1[0] * Math.cos(theta) + normalizedPerpendicular[0] * Math.sin(theta),
    norm1[1] * Math.cos(theta) + normalizedPerpendicular[1] * Math.sin(theta),
  ];

  // Interpolate between the magnitudes of vector1 and vector2
  const interpolatedMagnitude = (1 - time) * mag1 + time * mag2;

  // Scale the slerped direction by the interpolated magnitude
  const resultVector = [
    slerpedDirection[0] * interpolatedMagnitude,
    slerpedDirection[1] * interpolatedMagnitude,
  ];

  if (resultVector.some(Number.isNaN)) {
    return vector2;
  }
  return resultVector;
}

export default Canvas;
