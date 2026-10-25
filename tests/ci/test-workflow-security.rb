#!/usr/bin/env ruby
require 'psych'

workflow = Psych.safe_load_file(ARGV.fetch(0))
scans = workflow.fetch('jobs').values.flat_map { |job| job.fetch('steps') }
                .select { |step| step.fetch('uses', '').start_with?('aquasecurity/trivy-action@') }
abort 'No Trivy steps found' if scans.empty?

errors = scans.filter_map do |step|
  inputs = step.fetch('with')
  blocking = step.fetch('name').start_with?('Block ')
  severity = blocking ? 'HIGH,CRITICAL' : 'LOW,MEDIUM'
  exit_code = blocking ? '1' : '0'
  next if inputs['severity'] == severity && inputs['exit-code'] == exit_code &&
          (inputs.keys & %w[LOW MEDIUM HIGH CRITICAL]).empty?

  "#{step.fetch('name')}: expected severity=#{severity} and exit-code=#{exit_code}"
end
abort errors.join("\n") unless errors.empty?

puts "Trivy severity contracts passed (#{scans.length} steps)"
