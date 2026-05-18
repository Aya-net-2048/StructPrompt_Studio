#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use calamine::{open_workbook_auto, DataType, Reader};
use encoding_rs_io::DecodeReaderBytesBuilder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Serialize)]
struct ParsedData {
    columns: Vec<String>,
    rows: Vec<HashMap<String, String>>,
    total_size: String,
}

#[tauri::command]
fn parse_dataset(path: String, limit: usize) -> Result<ParsedData, String> {
    let path_obj = Path::new(&path);
    let ext = path_obj.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    
    let file_metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let size_mb = file_metadata.len() as f64 / 1024.0 / 1024.0;
    let total_size = format!("{:.2} MB", size_mb);

    let mut columns = Vec::new();
    let mut rows = Vec::new();

    if ext == "xlsx" || ext == "xls" {
        let mut workbook = open_workbook_auto(&path).map_err(|e| e.to_string())?;
        if let Some(Ok(range)) = workbook.worksheet_range_at(0) {
            let mut row_iter = range.rows();
            
            if let Some(header_row) = row_iter.next() {
                for cell in header_row {
                    columns.push(cell.to_string());
                }
            }

            for row in row_iter.take(limit) {
                let mut map = HashMap::new();
                for (i, cell) in row.iter().enumerate() {
                    if i < columns.len() {
                        map.insert(columns[i].clone(), cell.to_string());
                    }
                }
                rows.push(map);
            }
        } else {
            return Err("Excel 文件中没有工作表".into());
        }
    } else {
        // CSV parsing
        let mut file = File::open(&path).map_err(|e| e.to_string())?;
        let mut buffer = [0; 4096];
        let bytes_read = file.read(&mut buffer).unwrap_or(0);
        
        // Very basic UTF-8 validity check on the first chunk
        let is_utf8 = std::str::from_utf8(&buffer[..bytes_read]).is_ok();
        
        file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        
        let encoding = if is_utf8 { encoding_rs::UTF_8 } else { encoding_rs::GBK };
        
        let transcoded = DecodeReaderBytesBuilder::new()
            .encoding(Some(encoding))
            .build(file);
            
        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(true)
            .from_reader(transcoded);
            
        if let Ok(headers) = rdr.headers() {
            for header in headers {
                columns.push(header.to_string());
            }
        }
        
        for result in rdr.records().take(limit) {
            if let Ok(record) = result {
                let mut map = HashMap::new();
                for (i, field) in record.iter().enumerate() {
                    if i < columns.len() {
                        map.insert(columns[i].clone(), field.to_string());
                    }
                }
                rows.push(map);
            }
        }
    }
    
    Ok(ParsedData { columns, rows, total_size })
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![parse_dataset])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
