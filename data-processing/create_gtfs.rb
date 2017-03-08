require 'CSV'
require 'json'

# filename = "zurifaest-2016-07-01.csv"
filename_date = "2016-07-02"
filename = "zurifaest-#{filename_date}.csv"

delay_file_path = "#{Dir.pwd}/generated/#{filename}"


segment_rows_by_trip_id = {}
CSV.foreach(delay_file_path, :encoding => 'bom|utf-8', :headers => true) do |row|
    trip_id = row['fahrt_id']

    segment_row = {
        'segment_idx' => row['seq_von'].to_i - 1,

        # FROM
        'from_stop_code' => row['halt_kurz_von1'],
        'from_time_expected' => row['soll_ab_von'].to_i,
        'from_time_actual' => row['ist_ab_von'].to_i,

        # TO
        'to_stop_code' => row['halt_kurz_nach1'],
        'to_time_expected' => row['soll_an_nach'].to_i,
        'to_time_actual' => row['ist_an_nach1'].to_i,
    }

    next if segment_row['from_stop_code'] == segment_row['to_stop_code']

    # time_columns = ["soll_an_von", "ist_an_von", "soll_ab_von", "ist_ab_von", "soll_an_nach", "ist_an_nach1", "soll_ab_nach", "ist_ab_nach"]
    # print "#{segment_row['from_stop_code']}-#{segment_row['to_stop_code']}\n"
    # time_columns.each do |time_column|
    #     time_value = Time.at(row[time_column].to_i).utc.strftime("%H:%M:%S")
    #     print "     #{time_column.ljust(20, ' ')} -- #{time_value}\n"
    # end

    # exit

    if segment_rows_by_trip_id[trip_id].nil?
        segment_rows_by_trip_id[trip_id] = {
            'route_name' => row['linie'],
            'trip_id' => trip_id,
            'from_time_expected' => nil,
            'from_time_actual' => nil,
            'to_time_expected' => nil,
            'to_time_actual' => nil,
            'segments' => [],
        }
    end

    segment_rows_by_trip_id[trip_id]['segments'].push(segment_row)
end

routes_data = {}

segment_rows_by_trip_id.each do |trip_id, trip_data|
    stop_ids = []

    trip_data['segments'].sort_by!{ |el| el['segment_idx'] }

    # Calculate FROM/TO times for whole trip
    trip_data['from_time_expected'] = trip_data['segments'].first['from_time_expected']
    trip_data['from_time_actual'] = trip_data['segments'].first['from_time_actual']

    trip_data['to_time_expected'] = trip_data['segments'].last['to_time_expected']
    trip_data['to_time_actual'] = trip_data['segments'].last['to_time_actual']

    # Calculate delays and HH:MM:SS times
    trip_data['segments'].each do |segment_row|
        delay_a = segment_row['from_time_actual'] - segment_row['from_time_expected']
        delay_b = segment_row['to_time_actual'] - segment_row['to_time_expected']

        from_time = Time.at(segment_row['from_time_expected']).utc.strftime("%H:%M:%S")
        from_time_rt = Time.at(segment_row['from_time_actual']).utc.strftime("%H:%M:%S")
        to_time = Time.at(segment_row['to_time_expected']).utc.strftime("%H:%M:%S")
        to_time_rt = Time.at(segment_row['to_time_actual']).utc.strftime("%H:%M:%S")

        # print "#{segment_row['from_stop_code']} #{from_time}-#{from_time_rt}(#{delay_a}) - #{segment_row['to_stop_code']} #{to_time}-#{to_time_rt}(#{delay_b})\n"

        stop_ids.push(segment_row['from_stop_code'])
    end
    stop_ids.push(trip_data['segments'].last['to_stop_code'])

    route_code = stop_ids.join('_')

    route_name = trip_data['route_name']
    if routes_data[route_name].nil?
        routes_data[route_name] = {
            'route_codes' => {}
        }
    end

    if routes_data[route_name]['route_codes'][route_code].nil?
        routes_data[route_name]['route_codes'][route_code] = []
    end

    routes_data[route_name]['route_codes'][route_code].push(trip_data)
end

routes_data['9']['route_codes'].each do |route_code, route_data|
    print "#{route_data.size} #{route_data.first['trip_id']} #{route_code}\n"
end

routes_data_path = "#{Dir.pwd}/generated/routes_data_#{filename_date}.json"
File.open(routes_data_path, "w") {|f| f.write(JSON.pretty_generate(routes_data)) }


