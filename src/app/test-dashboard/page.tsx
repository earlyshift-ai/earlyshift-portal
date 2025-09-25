export default function TestDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Test Dashboard
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            This is a simple test dashboard to verify the server is working correctly.
          </p>
          
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              Current time: {new Date().toISOString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
