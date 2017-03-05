require 'CSV'
require 'json'

colors_csv_path = "#{Dir.pwd}/files/colors.csv"

colors_json = []
CSV.foreach(colors_csv_path, :encoding => 'bom|utf-8', :headers => true) do |row|
    colors_json_row = {}
    row.headers.each do |column_name|
        colors_json_row[column_name] = row[column_name]
    end

    colors_json << colors_json_row
end

colors_json_path = "#{Dir.pwd}/client/colors.json"
File.open(colors_json_path, "w") {|f| f.write(JSON.pretty_generate(colors_json)) }