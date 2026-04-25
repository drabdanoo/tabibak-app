import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../config/theme';
import { FEATURES } from '../config/features';

// Doctor Screens
import DoctorDashboardScreen    from '../screens/doctor/DoctorDashboardScreen';
import DoctorAppointmentsScreen from '../screens/doctor/DoctorAppointmentsScreen';
<<<<<<< HEAD
import DoctorAppointmentDetailScreen from '../screens/doctor/DoctorAppointmentDetailScreen';
import PatientDetailsScreen from '../screens/doctor/PatientDetailsScreen';
import PatientHistoryScreen from '../screens/doctor/PatientHistoryScreen';
import DoctorVisitNotesScreen from '../screens/doctor/DoctorVisitNotesScreen';
import EMRScreen from '../screens/doctor/EMRScreen';
import PrescriptionScreen from '../screens/doctor/PrescriptionScreen';
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen';
import DoctorSettingsScreen from '../screens/doctor/DoctorSettingsScreen';
import AppointmentDetailsScreen from '../screens/doctor/AppointmentDetailsScreen';
=======
import PatientDetailsScreen     from '../screens/doctor/PatientDetailsScreen';
import DoctorProfileScreen      from '../screens/doctor/DoctorProfileScreen';
import DoctorSettingsScreen     from '../screens/doctor/DoctorSettingsScreen';

// Feature-gated screens (always imported — tree-shaken when flags are false)
import EMRScreen          from '../screens/doctor/EMRScreen';
import PrescriptionScreen from '../screens/doctor/PrescriptionScreen';

// Shared Screens
import ChatScreen from '../screens/chat/ChatScreen';
>>>>>>> store/apple-safe

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Tab Navigator ────────────────────────────────────────────────────────────
const DoctorTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        if (route.name === 'Dashboard') {
          iconName = focused ? 'stats-chart' : 'stats-chart-outline';
        } else if (route.name === 'Appointments') {
          iconName = focused ? 'calendar' : 'calendar-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        }
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor:   Colors.primary,
      tabBarInactiveTintColor: Colors.gray,
      headerShown: false,
      tabBarStyle: {
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
    })}
  >
    <Tab.Screen name="Dashboard"   component={DoctorDashboardScreen} />
    <Tab.Screen name="Appointments" component={DoctorAppointmentsScreen} />
    <Tab.Screen name="Profile"     component={DoctorProfileScreen} />
  </Tab.Navigator>
);

<<<<<<< HEAD
// Stack Navigator for Doctor
const DoctorStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DoctorTabs"
        component={DoctorTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppointmentDetails"
        component={AppointmentDetailsScreen}
        options={{
          title: 'Appointment Details',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
      <Stack.Screen
        name="AppointmentDetail"
        component={DoctorAppointmentDetailScreen}
        options={{
          title: 'Appointment Details',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
      <Stack.Screen
        name="DoctorVisitNotes"
        component={DoctorVisitNotesScreen}
        options={{
          title: 'Visit Notes',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
      <Stack.Screen
        name="PatientHistory"
        component={PatientHistoryScreen}
        options={{
          title: 'Patient History',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
      <Stack.Screen
        name="PatientDetails"
        component={PatientDetailsScreen}
        options={{
          title: 'Patient Details',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
=======
// ─── Stack Navigator ──────────────────────────────────────────────────────────
const DoctorStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="DoctorTabs"
      component={DoctorTabs}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PatientDetails"
      component={PatientDetailsScreen}
      options={{
        title: 'Client Details',
        headerBackTitle: '',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
      }}
    />
    <Stack.Screen
      name="Settings"
      component={DoctorSettingsScreen}
      options={{
        title: 'Settings',
        headerBackTitle: '',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
      }}
    />
    <Stack.Screen
      name="Chat"
      component={ChatScreen}
      options={{ headerShown: false }}
    />

    {/* ── FEATURE FLAG: EMR Screen ── */}
    {FEATURES.EMR_SCREEN && (
>>>>>>> store/apple-safe
      <Stack.Screen
        name="EMR"
        component={EMRScreen}
        options={{
          title: 'Electronic Medical Record',
          headerBackTitle: '',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
        }}
      />
<<<<<<< HEAD
=======
    )}

    {/* ── FEATURE FLAG: Standalone Prescription Screen ── */}
    {FEATURES.PRESCRIPTION_SCREEN && (
>>>>>>> store/apple-safe
      <Stack.Screen
        name="Prescription"
        component={PrescriptionScreen}
        options={{
          title: 'Create Prescription',
          headerBackTitle: '',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
        }}
      />
<<<<<<< HEAD
      <Stack.Screen
        name="Settings"
        component={DoctorSettingsScreen}
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
    </Stack.Navigator>
  );
};
=======
    )}
  </Stack.Navigator>
);
>>>>>>> store/apple-safe

export default DoctorStack;
