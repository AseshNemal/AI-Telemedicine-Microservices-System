#!/bin/bash

echo "Starting port forwarding for AI Telemedicine Microservices System..."
echo "This script will forward traffic from your Mac's localhost to your Kubernetes cluster."
echo ""

# Find and kill any existing kubectl port-forward processes to prevent address-in-use errors
pkill -f "kubectl port-forward"
sleep 1

# Forward API Gateway Service (Using 8080 because port 80 often requires root on Mac)
echo "🌐 Forwarding API Gateway to http://localhost:8080"
kubectl port-forward -n default svc/api-gateway-nginx 8080:80 > /dev/null 2>&1 &
GATEWAY_PID=$!

# Forward Web App Service (Frontend)
echo "🖥️  Forwarding Web Frontend to http://localhost:3000"
kubectl port-forward -n default svc/web-app 3000:3000 > /dev/null 2>&1 &
WEB_PID=$!

# Forward Individual Backend Services (For direct debugging)
echo "🔧 Forwarding Individual Microservices:"
kubectl port-forward -n default svc/auth-service 8081:8081 > /dev/null 2>&1 &
AUTH_PID=$!
kubectl port-forward -n default svc/patient-service 5002:5002 > /dev/null 2>&1 &
PATIENT_PID=$!
kubectl port-forward -n default svc/doctor-service 8082:8082 > /dev/null 2>&1 &
DOCTOR_PID=$!
kubectl port-forward -n default svc/appointment-service 8083:8083 > /dev/null 2>&1 &
APPT_PID=$!
kubectl port-forward -n default svc/notification-service 8084:8084 > /dev/null 2>&1 &
NOTIFY_PID=$!
kubectl port-forward -n default svc/payment-service 8085:8085 > /dev/null 2>&1 &
PAY_PID=$!
kubectl port-forward -n default svc/telemedicine-service 8086:8086 > /dev/null 2>&1 &
TELEMED_PID=$!
kubectl port-forward -n default svc/symptom-service 8091:8091 > /dev/null 2>&1 &
SYMPTOM_PID=$!

echo "   - Auth:        http://localhost:8081"
echo "   - Patient:     http://localhost:5002"
echo "   - Doctor:      http://localhost:8082"
echo "   - Appointment: http://localhost:8083"
echo "   - Notification:http://localhost:8084"
echo "   - Payment:     http://localhost:8085"
echo "   - Telemedicine:http://localhost:8086"
echo "   - Symptom:     http://localhost:8091"

echo ""
echo "✅ Success! Your apps and individual services are now exposed locally."
echo "   - Web Frontend:  http://localhost:3000"
echo "   - API Gateway:   http://localhost:8080 (handles all traffic natively)"
echo "   - API Docs:      http://localhost:8080/api-docs"
echo ""
echo "Press Ctrl+C to stop the port forwarding."

# Trap Ctrl+C to clean up background processes
trap "echo 'Stopping port forwarding...'; kill $GATEWAY_PID $WEB_PID $AUTH_PID $PATIENT_PID $DOCTOR_PID $APPT_PID $NOTIFY_PID $PAY_PID $TELEMED_PID $SYMPTOM_PID; exit" INT

# Keep the script running to hold the port forwards open
wait
