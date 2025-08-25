use log::{info, debug, warn, error};
use env_logger;
use std::io::Write;
use chrono::Local;

pub fn init_logging() {
    env_logger::Builder::from_default_env()
        .format(|buf, record| {
            writeln!(
                buf,
                "[{} {} {}:{}] {}",
                Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                record.level(),
                record.file().unwrap_or("unknown"),
                record.line().unwrap_or(0),
                record.args()
            )
        })
        .filter_level(log::LevelFilter::Info)
        .init();
    
    info!("SuperCollider backend initialized");
    debug!("Debug logging enabled");
}

#[macro_export]
macro_rules! log_error {
    ($result:expr) => {
        if let Err(e) = $result {
            error!("Error: {}", e);
        }
    };
    ($result:expr, $msg:expr) => {
        if let Err(e) = $result {
            error!("{}: {}", $msg, e);
        }
    };
}

#[macro_export]
macro_rules! log_time {
    ($name:expr, $block:block) => {{
        let start = std::time::Instant::now();
        let result = $block;
        let duration = start.elapsed();
        debug!("{} took {:?}", $name, duration);
        result
    }};
}