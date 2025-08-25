use std::fs;
use std::path::Path;

fn generate_atom_icon() {
    use image::{ImageBuffer, Rgba};
    let size = 256u32;
    let mut img = ImageBuffer::<Rgba<u8>, _>::from_pixel(size, size, Rgba([255, 255, 255, 0]));
    let cx = (size / 2) as i32;
    let cy = (size / 2) as i32;
    let radius = (size as f32 * 0.35) as i32;
    for y in -6..=6 {
        for x in -6..=6 {
            let px = cx + x;
            let py = cy + y;
            if px >= 0 && py >= 0 && (x * x + y * y) <= 36 {
                img.put_pixel(px as u32, py as u32, Rgba([0, 120, 255, 255]));
            }
        }
    }
    for i in 0..3 {
        let angle = i as f32 * std::f32::consts::PI / 3.0;
        let a = radius as f32;
        let b = radius as f32 * 0.55;
        for t in 0..3600 {
            let th = (t as f32) * std::f32::consts::PI / 1800.0;
            let x = a * th.cos();
            let y = b * th.sin();
            let xr = x * angle.cos() - y * angle.sin();
            let yr = x * angle.sin() + y * angle.cos();
            let px = cx as f32 + xr;
            let py = cy as f32 + yr;
            let px_i = px.round() as i32;
            let py_i = py.round() as i32;
            if px_i >= 0 && py_i >= 0 && px_i < size as i32 && py_i < size as i32 {
                img.put_pixel(px_i as u32, py_i as u32, Rgba([0, 0, 0, 255]));
            }
        }
    }
    let out_dir = Path::new("icons");
    fs::create_dir_all(out_dir).expect("create icons dir");
    let png_path = out_dir.join("icon.png");
    img.save(&png_path).expect("save icon png");
    let ico_path = out_dir.join("icon.ico");
    let image = image::open(&png_path).expect("open png").to_rgba8();
    let (w, h) = image.dimensions();
    let mut icon_dir = ico::IconDir::new(ico::ResourceType::Icon);
    let entry = ico::IconImage::from_rgba_data(w, h, image.into_raw());
    icon_dir.add_entry(ico::IconDirEntry::encode(&entry).expect("encode ico"));
    let mut f = fs::File::create(&ico_path).expect("create ico file");
    icon_dir.write(&mut f).expect("write ico");
}

fn main() {
    generate_atom_icon();
    tauri_build::build()
}
