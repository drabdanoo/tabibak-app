import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/firestore_provider.dart';
import '../widgets/patient_appointment_card.dart';
import '../widgets/animated_card.dart';
import '../widgets/animated_list_tile.dart';
import '../widgets/page_transition.dart';
import 'login_screen.dart';
import 'chat_list_screen.dart';
import 'medical_records_screen.dart';
import 'patient_profile_screen.dart';
import 'patient/medical_history_screen.dart';
import 'patient/prescriptions_screen.dart';

class PatientDashboardScreen extends StatefulWidget {
  @override
  _PatientDashboardScreenState createState() => _PatientDashboardScreenState();
}

class _PatientDashboardScreenState extends State<PatientDashboardScreen> {
  int _selectedIndex = 0;

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  void _navigateToMedicalHistory(BuildContext context) {
    Navigator.push(
      context,
      PageTransition(
        page: MedicalHistoryScreen(),
      ),
    );
  }

  Widget _buildHomeContent(BuildContext context) {
    final firestoreProvider = Provider.of<FirestoreProvider>(context);
    
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Text(
                      'Welcome to Tabibak',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Your health dashboard',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 20),
            AnimatedCard(
              onTap: () => _navigateToMedicalHistory(context),
              child: AnimatedListTile(
                leading: Icon(Icons.medical_services, color: Theme.of(context).primaryColor),
                title: Text('Medical History'),
                subtitle: Text('Manage your allergies, medications and chronic conditions'),
                trailing: Icon(Icons.arrow_forward_ios),
              ),
            ),
            SizedBox(height: 20),
            AnimatedCard(
              onTap: () => _onItemTapped(3),
              child: AnimatedListTile(
                leading: Icon(Icons.medication, color: Theme.of(context).primaryColor),
                title: Text('My Prescriptions'),
                subtitle: Text('View and manage your prescriptions'),
                trailing: Icon(Icons.arrow_forward_ios),
              ),
            ),
            SizedBox(height: 20),
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Doctor Search - Coming Soon', textAlign: TextAlign.center),
              ),
            ),
            SizedBox(height: 20),
            Text(
              'Upcoming Appointments',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            SizedBox(height: 10),
            StreamBuilder(
              stream: firestoreProvider.patientAppointments,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return Center(child: CircularProgressIndicator());
                }
                
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                
                final appointments = snapshot.data ?? [];
                final upcomingAppointments = appointments
                    .where((apt) => 
                        apt.status != 'cancelled' && 
                        apt.status != 'completed')
                    .take(3)
                    .toList();
                
                if (upcomingAppointments.isEmpty) {
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(
                        'No upcoming appointments',
                        style: TextStyle(
                          fontStyle: FontStyle.italic,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                  );
                }
                
                return Column(
                  children: upcomingAppointments
                      .map((appointment) => PatientAppointmentCard(appointment: appointment))
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildAppointmentsContent(BuildContext context) {
    final firestoreProvider = Provider.of<FirestoreProvider>(context);
    
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'My Appointments',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            SizedBox(height: 20),
            Text(
              'Upcoming',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            SizedBox(height: 10),
            StreamBuilder(
              stream: firestoreProvider.patientAppointments,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return Center(child: CircularProgressIndicator());
                }
                
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                
                final appointments = snapshot.data ?? [];
                final upcomingAppointments = appointments
                    .where((apt) => 
                        apt.status != 'cancelled' && 
                        apt.status != 'completed')
                    .toList();
                
                if (upcomingAppointments.isEmpty) {
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(
                        'No upcoming appointments',
                        style: TextStyle(
                          fontStyle: FontStyle.italic,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                  );
                }
                
                return Column(
                  children: upcomingAppointments
                      .map((appointment) => PatientAppointmentCard(appointment: appointment))
                      .toList(),
                );
              },
            ),
            SizedBox(height: 20),
            Text(
              'Past Appointments',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            SizedBox(height: 10),
            StreamBuilder(
              stream: firestoreProvider.patientAppointments,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return Center(child: CircularProgressIndicator());
                }
                
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                
                final appointments = snapshot.data ?? [];
                final pastAppointments = appointments
                    .where((apt) => 
                        apt.status == 'cancelled' || 
                        apt.status == 'completed')
                    .toList();
                
                if (pastAppointments.isEmpty) {
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(
                        'No past appointments',
                        style: TextStyle(
                          fontStyle: FontStyle.italic,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                  );
                }
                
                return Column(
                  children: pastAppointments
                      .map((appointment) => PatientAppointmentCard(appointment: appointment))
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    List<Widget> _widgetOptions = <Widget>[
      _buildHomeContent(context),
      Center(child: Text('Doctor Search - Coming Soon')), // Placeholder for DoctorSearchCard
      _buildAppointmentsContent(context),
      PrescriptionsScreen(), // Added prescriptions screen
      PatientProfileScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text('Patient Dashboard'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: Icon(Icons.assignment),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => MedicalRecordsScreen()),
              );
            },
          ),
          IconButton(
            icon: Icon(Icons.message),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => ChatListScreen()),
              );
            },
          ),
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: () async {
              await authProvider.signOut();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (context) => LoginScreen()),
                  (route) => false,
                );
              }
            },
          ),
        ],
      ),
      body: _widgetOptions[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _selectedIndex,
        selectedItemColor: Theme.of(context).primaryColor,
        onTap: _onItemTapped,
        items: [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.search),
            label: 'Doctors',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_today),
            label: 'Appointments',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.medication),
            label: 'Prescriptions',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}