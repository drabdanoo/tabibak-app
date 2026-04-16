import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../config/theme';
import { FEATURES } from '../config/features';

// Patient Screens
import PatientHomeScreen      from '../screens/patient/PatientHomeScreen';
import DoctorListScreen       from '../screens/patient/DoctorListScreen';
import DoctorDetailsScreen    from '../screens/patient/DoctorDetailsScreen';
import DoctorProfileScreen    from '../screens/patient/DoctorProfileScreen';
import BookAppointmentScreen  from '../screens/patient/BookAppointmentScreen';
import MyAppointmentsScreen   from '../screens/patient/MyAppointmentsScreen';
import PatientProfileScreen   from '../screens/patient/PatientProfileScreen';
import DoctorMapScreen        from '../screens/patient/DoctorMapScreen';

// Feature-gated screens (always imported — tree-shaken when flags are false)
import MedicalDocumentsScreen from '../screens/patient/MedicalDocumentsScreen';
import LabOrdersScreen        from '../screens/patient/LabOrdersScreen';
import PrescriptionInboxScreen from '../screens/patient/PrescriptionInboxScreen';

// Shared Screens
import ChatScreen from '../screens/chat/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Tab Navigator ────────────────────────────────────────────────────────────
const PatientTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Appointments') {
          iconName = focused ? 'calendar' : 'calendar-outline';
        } else if (route.name === 'Documents') {
          iconName = focused ? 'document-text' : 'document-text-outline';
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
    <Tab.Screen name="Home"         component={PatientHomeScreen} />
    <Tab.Screen name="Appointments" component={MyAppointmentsScreen} />

    {/* ── FEATURE FLAG: Medical Documents tab ── */}
    {FEATURES.MEDICAL_DOCUMENTS_TAB && (
      <Tab.Screen name="Documents" component={MedicalDocumentsScreen} />
    )}

    <Tab.Screen name="Profile" component={PatientProfileScreen} />
  </Tab.Navigator>
);

// ─── Stack Navigator ──────────────────────────────────────────────────────────
const PatientStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="PatientTabs"
      component={PatientTabs}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="DoctorList"
      component={DoctorListScreen}
      options={{
        title: 'Find a Provider',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
      }}
    />
    <Stack.Screen
      name="DoctorDetails"
      component={DoctorDetailsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="DoctorProfile"
      component={DoctorProfileScreen}
      options={{
        title: 'Provider Profile',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
      }}
    />
    <Stack.Screen
      name="BookAppointment"
      component={BookAppointmentScreen}
      options={{
        title: 'Book Appointment',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
      }}
    />
    <Stack.Screen
      name="Chat"
      component={ChatScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="DoctorMap"
      component={DoctorMapScreen}
      options={{ headerShown: false }}
    />

    {/* ── FEATURE FLAG: Lab Orders ── */}
    {FEATURES.LAB_ORDERS && (
      <Stack.Screen
        name="LabOrders"
        component={LabOrdersScreen}
        options={{ headerShown: false }}
      />
    )}

    {/* ── FEATURE FLAG: Prescription Inbox ── */}
    {FEATURES.PRESCRIPTION_INBOX && (
      <Stack.Screen
        name="PrescriptionInbox"
        component={PrescriptionInboxScreen}
        options={{ headerShown: false }}
      />
    )}
  </Stack.Navigator>
);

export default PatientStack;
